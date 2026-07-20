import { getDataSource, NotificationOutbox } from "@pegasus/core";
import { IsNull } from "typeorm";
import { getBeamsClient } from "../lib/beams-client.js";
import { withTimeout } from "../lib/with-timeout.js";

const BEAMS_TIMEOUT_MS = 15_000;

type WebNotificationPayload = {
  title: string;
  body: string;
  deep_link?: string;
  tag?: string;
};

function logPushFailure(notificationIds: string[], errorMessage: string): void {
  console.log(
    JSON.stringify({
      level: "ERROR",
      service: process.env.SERVICE_NAME ?? "pegaso-api",
      event: "PUSH_NOTIFICATION_FAILED",
      notificationIds,
      error: errorMessage,
      ts: new Date().toISOString()
    })
  );
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

function toBeamsDeepLink(notification: Pick<NotificationOutbox, "payload">): string | undefined {
  const deepLink = typeof notification.payload?.deepLink === "string" ? notification.payload.deepLink : "/staff";

  try {
    return new URL(deepLink).toString();
  } catch {
    const origin = getPublicWebOrigin();
    return origin ? new URL(deepLink, origin).toString() : undefined;
  }
}

function buildBeamsPayload(notification: Pick<NotificationOutbox, "id" | "title" | "body" | "payload">) {
  const webNotification: WebNotificationPayload = {
    title: notification.title,
    body: notification.body,
    tag: notification.id
  };

  const deepLink = toBeamsDeepLink(notification);
  if (deepLink) {
    webNotification.deep_link = deepLink;
  }

  return {
    web: {
      notification: webNotification,
      data: { notificationId: notification.id }
    }
  };
}

function groupKey(notification: NotificationOutbox): string {
  return `${notification.type}::${notification.title}::${notification.body}`;
}

async function publishGroup(notifications: NotificationOutbox[]): Promise<void> {
  const [representative] = notifications;
  if (!representative) return;

  const userIds = Array.from(
    new Set(notifications.map((notification) => notification.recipientUserId).filter((id): id is string => Boolean(id)))
  );
  const ids = notifications.map((notification) => notification.id);

  if (userIds.length === 0) {
    return;
  }

  try {
    await withTimeout(
      getBeamsClient().publishToUsers(userIds, buildBeamsPayload(representative)),
      BEAMS_TIMEOUT_MS,
      `Pusher Beams timeout tras ${BEAMS_TIMEOUT_MS}ms`
    );

    const dataSource = await getDataSource();
    await dataSource.getRepository(NotificationOutbox).update(ids, { sentAt: new Date() });
  } catch (error) {
    logPushFailure(ids, error instanceof Error ? error.message : "Error desconocido.");
  }
}

/**
 * Envía de inmediato, vía Pusher Beams, las notificaciones aún no enviadas de una etapa.
 *
 * Sin colas, estados intermedios, reintentos ni cron: cada acción de juzgamiento dispara
 * su propio envío justo después de confirmar en base de datos. Si Beams falla, se registra
 * en logs y ya (Beams es confiable; un fallo puntual no debe bloquear ni reintentarse solo).
 * Las filas quedan disponibles igual en el inbox aunque el push no se haya podido publicar.
 */
export async function sendStageNotifications(fairCategoryStageId: string): Promise<void> {
  const dataSource = await getDataSource();
  const pending = await dataSource.getRepository(NotificationOutbox).find({
    where: { fairCategoryStageId, sentAt: IsNull() }
  });

  if (pending.length === 0) {
    return;
  }

  const groups = new Map<string, NotificationOutbox[]>();
  for (const notification of pending) {
    const key = groupKey(notification);
    groups.set(key, [...(groups.get(key) ?? []), notification]);
  }

  await Promise.all(Array.from(groups.values(), publishGroup));
}
