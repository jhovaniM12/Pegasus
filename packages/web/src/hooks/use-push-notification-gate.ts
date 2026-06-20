"use client";

import { useCallback, useEffect, useState } from "react";
import * as PusherPushNotifications from "@pusher/push-notifications-web";

export type PushGateStatus =
  | "checking"
  | "enabled"
  | "needs_activation"
  | "needs_reactivation"
  | "activating"
  | "blocked"
  | "unsupported"
  | "error";

function getBeamsClient(): PusherPushNotifications.Client | null {
  const instanceId = process.env.NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID;
  if (!instanceId) return null;
  return new PusherPushNotifications.Client({ instanceId });
}

/**
 * Tracks whether this user has push notifications enabled.
 * Returns gated === true when the user must activate/reactivate before operating.
 */
export function usePushNotificationGate(userId: string | null | undefined) {
  const [status, setStatus] = useState<PushGateStatus>("checking");

  const checkStatus = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("blocked");
      return;
    }

    if (!userId) {
      setStatus("checking");
      return;
    }

    const beamsClient = getBeamsClient();
    if (!beamsClient) {
      setStatus("unsupported");
      return;
    }

    try {
      const [registrationState, registeredUserId] = await Promise.all([
        beamsClient.getRegistrationState(),
        beamsClient.getUserId().catch(() => null),
      ]);

      const isRegistered =
        registrationState ===
        PusherPushNotifications.RegistrationState.PERMISSION_GRANTED_REGISTERED_WITH_BEAMS;

      if (isRegistered && registeredUserId === userId) {
        setStatus("enabled");
        return;
      }

      if (isRegistered && registeredUserId && registeredUserId !== userId) {
        setStatus("needs_reactivation");
        return;
      }

      setStatus("needs_activation");
    } catch {
      setStatus("needs_activation");
    }
  }, [userId]);

  useEffect(() => {
    window.setTimeout(() => void checkStatus(), 0);
  }, [checkStatus]);

  const activate = useCallback(async () => {
    if (!userId) return;

    const beamsClient = getBeamsClient();
    if (!beamsClient) return;

    setStatus("activating");

    try {
      const registeredUserId = await beamsClient.getUserId().catch(() => null);

      if (registeredUserId && registeredUserId !== userId) {
        await beamsClient.clearAllState();
      }

      await beamsClient.start();

      const tokenProvider = new PusherPushNotifications.TokenProvider({
        url: "/api/staff/push/beams-token",
      });

      await beamsClient.setUserId(userId, tokenProvider);
      await checkStatus();
    } catch {
      setStatus("error");
    }
  }, [checkStatus, userId]);

  const isGated =
    status === "needs_activation" ||
    status === "needs_reactivation" ||
    status === "activating" ||
    status === "error";

  return { status, isGated, activate, recheck: checkStatus };
}
