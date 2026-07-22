"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

export type PushGateErrorCode =
  | "permission_denied"
  | "unsupported"
  | "service_worker"
  | "token"
  | "beams_state"
  | "unknown";

function getPushGateErrorCode(error: unknown): PushGateErrorCode {
  if ("Notification" in window && Notification.permission === "denied") {
    return "permission_denied";
  }

  const message = error instanceof Error ? error.message : "";
  if (message.includes("Service Worker") || message.includes("service worker")) {
    return "service_worker";
  }
  if (message.includes("401") || message.includes("403") || message.includes("token")) {
    return "token";
  }
  if (
    message.includes("Changing the `userId` is not allowed") ||
    message.includes("SDK not registered with Beams") ||
    message.includes(".start must be called before .setUserId")
  ) {
    return "beams_state";
  }

  return "unknown";
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;

  await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

async function getBeamsClient(): Promise<PusherPushNotifications.Client | null> {
  const instanceId = process.env.NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID;
  if (!instanceId) return null;

  const serviceWorkerRegistration = await getServiceWorkerRegistration();
  return new PusherPushNotifications.Client({ instanceId, serviceWorkerRegistration });
}

/**
 * Tracks whether this user has push notifications enabled.
 * Returns gated === true when the user must activate/reactivate before operating.
 */
export function usePushNotificationGate(userId: string | null | undefined) {
  const [status, setStatus] = useState<PushGateStatus>("checking");
  const [errorCode, setErrorCode] = useState<PushGateErrorCode | null>(null);
  const autoActivationAttemptRef = useRef<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      setErrorCode("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("blocked");
      setErrorCode("permission_denied");
      return;
    }

    if (!userId) {
      setStatus("checking");
      setErrorCode(null);
      return;
    }

    try {
      const beamsClient = await getBeamsClient();
      if (!beamsClient) {
        setStatus("unsupported");
        setErrorCode("unsupported");
        return;
      }

      const [registrationState, registeredUserId] = await Promise.all([
        beamsClient.getRegistrationState(),
        beamsClient.getUserId().catch(() => null),
      ]);

      const isRegistered =
        registrationState ===
        PusherPushNotifications.RegistrationState.PERMISSION_GRANTED_REGISTERED_WITH_BEAMS;

      if (isRegistered && registeredUserId === userId) {
        setStatus("enabled");
        setErrorCode(null);
        return;
      }

      if (isRegistered && registeredUserId && registeredUserId !== userId) {
        setStatus("needs_reactivation");
        setErrorCode(null);
        return;
      }

      setStatus("needs_activation");
      setErrorCode(null);
    } catch (error) {
      setStatus("needs_activation");
      setErrorCode(getPushGateErrorCode(error));
    }
  }, [userId]);

  useEffect(() => {
    window.setTimeout(() => void checkStatus(), 0);
  }, [checkStatus]);

  const activate = useCallback(async () => {
    if (!userId) return;

    setStatus("activating");
    setErrorCode(null);

    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setStatus("unsupported");
        setErrorCode("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        setStatus("blocked");
        setErrorCode("permission_denied");
        return;
      }

      const beamsClient = await getBeamsClient();
      if (!beamsClient) {
        setStatus("unsupported");
        setErrorCode("unsupported");
        return;
      }

      const registrationState = await beamsClient.getRegistrationState();
      const registeredUserId = await beamsClient.getUserId().catch(() => null);
      const hasBeamsRegistration =
        registrationState ===
        PusherPushNotifications.RegistrationState.PERMISSION_GRANTED_REGISTERED_WITH_BEAMS;

      if (registeredUserId || hasBeamsRegistration || status === "error") {
        await beamsClient.clearAllState();
      }

      await beamsClient.start();

      const tokenProvider = new PusherPushNotifications.TokenProvider({
        url: "/api/staff/push/beams-token",
      });

      await beamsClient.setUserId(userId, tokenProvider);
      await checkStatus();
    } catch (error) {
      setStatus("error");
      setErrorCode(getPushGateErrorCode(error));
    }
  }, [checkStatus, status, userId]);

  const isGated =
    status === "needs_activation" ||
    status === "needs_reactivation" ||
    status === "activating" ||
    status === "blocked" ||
    status === "error";

  useEffect(() => {
    const canAutoActivate =
      Boolean(userId) &&
      "Notification" in window &&
      Notification.permission === "granted" &&
      (status === "needs_activation" || status === "needs_reactivation");

    if (!canAutoActivate) return;

    const attemptKey = `${userId}:${status}`;
    if (autoActivationAttemptRef.current === attemptKey) return;

    autoActivationAttemptRef.current = attemptKey;
    void activate();
  }, [activate, status, userId]);

  return { status, errorCode, isGated, activate, recheck: checkStatus };
}
