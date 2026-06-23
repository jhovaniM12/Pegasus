import type { NotificationOutbox } from "@pegasus/core";

export function shouldSkipPublishBecauseAlreadyAttempted(
  notification: Pick<NotificationOutbox, "publishAttemptedAt" | "status">
): boolean {
  return notification.publishAttemptedAt !== null;
}

export function isDispatchTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("timeout");
}
