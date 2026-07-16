import { getDataSource, NotificationOutbox, User, type UserRole } from "@pegasus/core";
import type { EntityManager } from "typeorm";
import { getBeamsClient } from "../lib/beams-client.js";
import { withTimeout } from "../lib/with-timeout.js";

const BEAMS_TIMEOUT_MS = 8_000;
const DISPATCH_LOCK_TIMEOUT_MS = 2 * 60_000;
const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [5_000, 30_000, 2 * 60_000, 5 * 60_000, 15 * 60_000];

type DispatchNotification = {
  id: string;
  recipientUserId: string | null;
  recipientRole: string | null;
  fairCategoryStageId: string | null;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  attemptCount: number;
};

type DispatchResult = {
  claimed: number;
  sent: number;
  failed: number;
  groups: number;
};

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

function notificationDeepLink(notification: Pick<NotificationOutbox, "payload">): string | null {
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

function toBeamsDeepLink(notification: Pick<NotificationOutbox, "payload">): string | undefined {
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

async function resolveTargetUserIds(
  manager: EntityManager,
  notification: Pick<NotificationOutbox, "recipientUserId" | "recipientRole">
): Promise<string[]> {
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

async function publishToBeams(
  notification: Pick<NotificationOutbox, "id" | "title" | "body" | "payload">,
  userIds: string[]
): Promise<string | null> {
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

async function publishNotificationsToUsers(
  notification: Pick<NotificationOutbox, "id" | "title" | "body" | "payload">,
  userIds: string[]
): Promise<string | null> {
  if (userIds.length === 0) {
    return null;
  }

  return publishToBeams(notification, Array.from(new Set(userIds)));
}

function dispatchGroupKey(notification: DispatchNotification): string {
  return JSON.stringify({
    stageId: notification.fairCategoryStageId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    payload: notification.payload ?? null
  });
}

function nextRetryAt(attemptCount: number, now: Date): Date | null {
  if (attemptCount >= MAX_ATTEMPTS) {
    return null;
  }

  const delayMs = RETRY_DELAYS_MS[Math.min(attemptCount - 1, RETRY_DELAYS_MS.length - 1)];
  return new Date(now.getTime() + delayMs);
}

async function claimPendingNotifications(
  manager: EntityManager,
  limit: number,
  now: Date
): Promise<DispatchNotification[]> {
  const staleBefore = new Date(now.getTime() - DISPATCH_LOCK_TIMEOUT_MS);
  const rows = (await manager.query(
    `
      WITH candidates AS (
        SELECT id
        FROM notification_outbox
        WHERE (
          (status = 'PENDING' OR (status = 'FAILED' AND attempt_count < $2))
          AND (next_retry_at IS NULL OR next_retry_at <= $1)
        )
        OR (
          status = 'PROCESSING'
          AND processing_started_at IS NOT NULL
          AND processing_started_at < $3
          AND attempt_count < $2
        )
        ORDER BY created_at ASC
        LIMIT $4
        FOR UPDATE SKIP LOCKED
      )
      UPDATE notification_outbox notification
      SET
        status = 'PROCESSING',
        processing_started_at = $1,
        publish_attempted_at = $1
      FROM candidates
      WHERE notification.id = candidates.id
      RETURNING
        notification.id,
        notification.recipient_user_id AS "recipientUserId",
        notification.recipient_role AS "recipientRole",
        notification.fair_category_stage_id AS "fairCategoryStageId",
        notification.type,
        notification.title,
        notification.body,
        notification.payload,
        notification.attempt_count AS "attemptCount"
    `,
    [now, MAX_ATTEMPTS, staleBefore, limit]
  )) as DispatchNotification[];

  return rows;
}

async function markSent(
  manager: EntityManager,
  ids: string[],
  beamsPublishId: string | null,
  now: Date
): Promise<void> {
  if (ids.length === 0) return;

  await manager
    .getRepository(NotificationOutbox)
    .createQueryBuilder()
    .update(NotificationOutbox)
    .set({
      status: "SENT",
      sentAt: now,
      failedAt: null,
      errorMessage: null,
      nextRetryAt: null,
      processingStartedAt: null,
      beamsPublishId
    })
    .where("id IN (:...ids)", { ids })
    .execute();
}

async function markFailed(
  manager: EntityManager,
  notifications: DispatchNotification[],
  errorMessage: string,
  now: Date
): Promise<void> {
  for (const notification of notifications) {
    const attemptCount = notification.attemptCount + 1;
    await manager.getRepository(NotificationOutbox).update(notification.id, {
      status: "FAILED",
      attemptCount,
      failedAt: now,
      errorMessage,
      nextRetryAt: nextRetryAt(attemptCount, now),
      processingStartedAt: null
    });
    logSendFailure(notification.id, errorMessage);
  }
}

/**
 * Reclama y despacha notificaciones pendientes fuera del flujo transaccional
 * de negocio. Agrupa filas equivalentes para publicar una sola push a varios usuarios,
 * preservando una fila de inbox por destinatario.
 */
export async function dispatchPendingNotifications({
  limit = 50,
  now = new Date()
}: {
  limit?: number;
  now?: Date;
} = {}): Promise<DispatchResult> {
  const dataSource = await getDataSource();
  const manager = dataSource.manager;
  const claimed = await dataSource.transaction((transactionManager) =>
    claimPendingNotifications(transactionManager, Math.max(1, Math.min(limit, 200)), now)
  );
  const groups = new Map<string, DispatchNotification[]>();

  for (const notification of claimed) {
    const key = dispatchGroupKey(notification);
    groups.set(key, [...(groups.get(key) ?? []), notification]);
  }

  let sent = 0;
  let failed = 0;

  for (const notifications of groups.values()) {
    const [representative] = notifications;
    if (!representative) continue;

    try {
      const nestedUserIds = await Promise.all(
        notifications.map((notification) => resolveTargetUserIds(manager, notification))
      );
      const userIds = nestedUserIds.flat();
      const beamsPublishId = await publishNotificationsToUsers(representative, userIds);
      await markSent(manager, notifications.map((notification) => notification.id), beamsPublishId, now);
      sent += notifications.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido.";
      await markFailed(manager, notifications, errorMessage, now);
      failed += notifications.length;
    }
  }

  return { claimed: claimed.length, sent, failed, groups: groups.size };
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
