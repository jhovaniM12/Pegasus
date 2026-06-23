import { NotificationOutbox, User, type UserRole } from "@pegasus/core";
import type { EntityManager } from "typeorm";
import { getBeamsClient } from "../lib/beams-client.js";
import { withTimeout } from "../lib/with-timeout.js";

const BEAMS_TIMEOUT_MS = 8_000;

type WebNotificationPayload = {
  title: string;
  body: string;
  deep_link?: string;
  tag?: string;
};

function logSendFailure(notificationId: string, errorMessage: string): void {
  console.log(
    JSON.stringify({
      level: "ERROR",
      service: process.env.SERVICE_NAME ?? "pegasus-api",
      event: "NOTIFICATION_SEND_FAILED",
      notificationId,
      error: errorMessage,
      ts: new Date().toISOString()
    })
  );
}

function notificationDeepLink(notification: NotificationOutbox): string | null {
  return typeof notification.payload?.deepLink === "string" ? notification.payload.deepLink : null;
}

function getPublicWebOrigin(): string | null {
  const origin =
    process.env.PUSHER_BEAMS_WEB_ORIGIN ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.VERCEL_URL ??
    null;

  if (!origin) {
    return null;
  }

  return origin.startsWith("http://") || origin.startsWith("https://") ? origin : `https://${origin}`;
}

function toBeamsDeepLink(notification: NotificationOutbox): string | undefined {
  const deepLink = notificationDeepLink(notification) ?? "/staff";

  try {
    return new URL(deepLink).toString();
  } catch {
    const origin = getPublicWebOrigin();
    if (!origin) {
      return undefined;
    }

    return new URL(deepLink, origin).toString();
  }
}

async function resolveTargetUserIds(manager: EntityManager, notification: NotificationOutbox): Promise<string[]> {
  if (notification.recipientUserId) {
    return [notification.recipientUserId];
  }

  if (!notification.recipientRole) {
    return [];
  }

  const users = await manager.getRepository(User).find({
    where: {
      role: notification.recipientRole as UserRole,
      isActive: true
    }
  });

  return users.map((user) => user.id);
}

async function publishToBeams(notification: NotificationOutbox, userIds: string[]): Promise<string | null> {
  const deepLink = toBeamsDeepLink(notification);
  const webNotification: WebNotificationPayload = {
    title: notification.title,
    body: notification.body,
    tag: notification.id
  };

  if (deepLink) {
    webNotification.deep_link = deepLink;
  }

  const response = (await withTimeout(
    getBeamsClient().publishToUsers(userIds, {
      web: {
        notification: webNotification,
        data: {
          notificationId: notification.id
        }
      }
    }),
    BEAMS_TIMEOUT_MS,
    `Pusher Beams timeout after ${BEAMS_TIMEOUT_MS}ms`
  )) as { publishId?: string };

  return response.publishId ?? null;
}

/**
 * Envía una notificación ya persistida y actualiza SENT/FAILED.
 * Nunca lanza: un fallo de Beams no debe romper la acción de juzgamiento.
 */
export async function deliverNotification(
  manager: EntityManager,
  notification: NotificationOutbox
): Promise<void> {
  const repo = manager.getRepository(NotificationOutbox);

  try {
    const userIds = await resolveTargetUserIds(manager, notification);

    if (userIds.length === 0) {
      notification.status = "SENT";
      notification.sentAt = new Date();
      notification.failedAt = null;
      notification.errorMessage = null;
      await repo.save(notification);
      return;
    }

    const beamsPublishId = await publishToBeams(notification, userIds);
    notification.status = "SENT";
    notification.sentAt = new Date();
    notification.failedAt = null;
    notification.errorMessage = null;
    notification.beamsPublishId = beamsPublishId;
    await repo.save(notification);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido.";
    notification.status = "FAILED";
    notification.failedAt = new Date();
    notification.errorMessage = errorMessage;
    await repo.save(notification);
    logSendFailure(notification.id, errorMessage);
  }
}
