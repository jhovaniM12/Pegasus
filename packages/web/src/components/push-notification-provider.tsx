"use client";

import { createContext, useContext } from "react";
import {
  usePushNotificationGate,
  type PushGateErrorCode,
  type PushGateStatus,
} from "@/hooks/use-push-notification-gate";

type PushNotificationContextValue = {
  status: PushGateStatus;
  errorCode: PushGateErrorCode | null;
  isGated: boolean;
  activate: () => Promise<void>;
  recheck: () => Promise<void>;
};

const PushNotificationContext = createContext<PushNotificationContextValue | null>(null);

export function PushNotificationProvider({
  userId,
  children,
}: {
  userId: string | null | undefined;
  children: React.ReactNode;
}) {
  const value = usePushNotificationGate(userId);

  return (
    <PushNotificationContext.Provider value={value}>{children}</PushNotificationContext.Provider>
  );
}

export function usePushNotifications(): PushNotificationContextValue {
  const context = useContext(PushNotificationContext);
  if (!context) {
    throw new Error("usePushNotifications debe usarse dentro de PushNotificationProvider.");
  }
  return context;
}

export function usePushNotificationsOptional(): PushNotificationContextValue | null {
  return useContext(PushNotificationContext);
}
