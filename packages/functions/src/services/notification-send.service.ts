import { FairCategoryStage, getDataSource, NotificationOutbox } from "@pegasus/core";
import { IsNull } from "typeorm";
import { getBeamsClient } from "../lib/beams-client.js";
import { withTimeout } from "../lib/with-timeout.js";
import { getUsersByFairRole, type StaffRoleExternalId } from "./judging/shared.js";

const BEAMS_TIMEOUT_MS = 5_000;

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

function relativeDeepLink(notification: Pick<NotificationOutbox, "payload">): string {
  const deepLink = typeof notification.payload?.deepLink === "string" ? notification.payload.deepLink : "/staff";
  try {
    return new URL(deepLink).pathname + new URL(deepLink).search + new URL(deepLink).hash;
  } catch {
    return deepLink.startsWith("/") ? deepLink : `/${deepLink}`;
  }
}

export function buildBeamsPayload(
  notification: Pick<NotificationOutbox, "id" | "type" | "title" | "body" | "payload">
) {
  const webNotification: WebNotificationPayload = {
    title: notification.title,
    body: notification.body,
    tag: notification.id
  };

  const absoluteDeepLink = toBeamsDeepLink(notification);
  if (absoluteDeepLink) {
    webNotification.deep_link = absoluteDeepLink;
  }

  const payload = notification.payload ?? {};

  return {
    web: {
      notification: webNotification,
      // Datos para el SW / tabs abiertos: toast in-app sin esperar GET /notifications.
      data: {
        kind: "INBOX_NOTIFICATION",
        notificationId: notification.id,
        notificationType: notification.type,
        title: notification.title,
        body: notification.body,
        deepLink: relativeDeepLink(notification),
        fairName: typeof payload.fairName === "string" ? payload.fairName : "",
        categoryName: typeof payload.categoryName === "string" ? payload.categoryName : "",
        gaitName: typeof payload.gaitName === "string" ? payload.gaitName : ""
      }
    }
  };
}

async function publishNotification(notification: NotificationOutbox): Promise<void> {
  if (!notification.recipientUserId) {
    return;
  }

  try {
    await withTimeout(
      // Cada destinatario debe recibir el ID de su propia fila de inbox. Un payload
      // compartido impediría deduplicar de forma fiable el push contra GET /notifications.
      getBeamsClient().publishToUsers(
        [notification.recipientUserId],
        buildBeamsPayload(notification)
      ),
      BEAMS_TIMEOUT_MS,
      `Pusher Beams timeout tras ${BEAMS_TIMEOUT_MS}ms`
    );

    const dataSource = await getDataSource();
    await dataSource
      .getRepository(NotificationOutbox)
      .update(notification.id, { sentAt: new Date() });
  } catch (error) {
    logPushFailure(
      [notification.id],
      error instanceof Error ? error.message : "Error desconocido."
    );
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

  await Promise.all(pending.map(publishNotification));
}

/**
 * Envía una señal push sin notificación visible para refrescar pantallas abiertas.
 * Se usa cuando el destinatario operativo debe ver cambios en vivo, pero no debe
 * recibir una notificación de inbox/sistema para esa acción.
 */
export async function sendStageRefreshSignal(fairCategoryStageId: string, roleExternalId: StaffRoleExternalId): Promise<void> {
  const dataSource = await getDataSource();
  const userIds = await dataSource.transaction(async (manager) => {
    const stage = await manager.getRepository(FairCategoryStage).findOne({
      where: { id: fairCategoryStageId }
    });

    if (!stage) {
      return [];
    }

    const users = await getUsersByFairRole(manager, stage.fairId, roleExternalId);
    return users.map((user) => user.id);
  });

  if (userIds.length === 0) {
    return;
  }

  try {
    await withTimeout(
      getBeamsClient().publishToUsers(userIds, {
        web: {
          time_to_live: 60,
          data: {
            kind: "STAFF_REFRESH",
            type: "STAFF_REFRESH",
            fairCategoryStageId
          }
        }
      }),
      BEAMS_TIMEOUT_MS,
      `Pusher Beams refresh timeout tras ${BEAMS_TIMEOUT_MS}ms`
    );
  } catch (error) {
    logPushFailure([`refresh:${fairCategoryStageId}:${roleExternalId}`], error instanceof Error ? error.message : "Error desconocido.");
  }
}
