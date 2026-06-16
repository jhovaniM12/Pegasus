"use client";

import { useEffect, useState } from "react";
import * as PusherPushNotifications from "@pusher/push-notifications-web";
import { Button } from "@/components/ui/button";

function getBeamsClient() {
  const instanceId = process.env.NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID;

  if (!instanceId) {
    return null;
  }

  return new PusherPushNotifications.Client({ instanceId });
}

export function PushNotificationPrompt({ userId }: { userId: string | null | undefined }) {
  const [status, setStatus] = useState<
    "checking" | "idle" | "mismatch" | "loading" | "enabled" | "unsupported" | "blocked" | "error"
  >("checking");

  useEffect(() => {
    let cancelled = false;

    const checkNotificationState = async () => {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("blocked");
        return;
      }

      if (!userId) {
        if (!cancelled) setStatus("checking");
        return;
      }

      const beamsClient = getBeamsClient();
      if (!beamsClient) {
        if (!cancelled) setStatus("error");
        return;
      }

      try {
        const [registrationState, registeredUserId] = await Promise.all([
          beamsClient.getRegistrationState(),
          beamsClient.getUserId().catch(() => null),
        ]);

        if (cancelled) return;

        if (
          registrationState === PusherPushNotifications.RegistrationState.PERMISSION_GRANTED_REGISTERED_WITH_BEAMS &&
          registeredUserId === userId
        ) {
          setStatus("enabled");
          return;
        }

        if (
          registrationState === PusherPushNotifications.RegistrationState.PERMISSION_GRANTED_REGISTERED_WITH_BEAMS &&
          registeredUserId &&
          registeredUserId !== userId
        ) {
          setStatus("mismatch");
          return;
        }

        setStatus("idle");
      } catch {
        if (!cancelled) setStatus("idle");
      }
    };

    void checkNotificationState();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const enableNotifications = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }

    const beamsClient = getBeamsClient();

    if (!beamsClient || !userId) {
      setStatus("error");
      return;
    }

    setStatus("loading");

    try {
      const registeredUserId = await beamsClient.getUserId().catch(() => null);

      if (registeredUserId && registeredUserId !== userId) {
        await beamsClient.clearAllState();
      } else {
        await beamsClient.start();
      }

      const tokenProvider = new PusherPushNotifications.TokenProvider({
        url: "/api/staff/push/beams-token",
      });

      await beamsClient.setUserId(userId, tokenProvider);
      setStatus("enabled");
    } catch {
      setStatus("error");
    }
  };

  if (status === "enabled") {
    return <p className="text-xs text-emerald-700">Notificaciones activas.</p>;
  }

  if (status === "unsupported") {
    return <p className="text-xs text-slate-500">Este navegador no soporta notificaciones push.</p>;
  }

  if (status === "blocked") {
    return <p className="text-xs text-slate-500">Notificaciones bloqueadas en el navegador.</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={status === "loading"}
        onClick={enableNotifications}
      >
        {status === "checking"
          ? "Verificando..."
          : status === "loading"
            ? "Activando..."
            : status === "mismatch"
              ? "Reactivar notificaciones"
              : "Activar notificaciones"}
      </Button>
      {status === "error" && <p className="text-xs text-red-600">No fue posible activar push.</p>}
    </div>
  );
}
