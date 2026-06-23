import { getDataSource, NotificationOutbox } from "@pegasus/core";
import { In } from "typeorm";
import { getBeamsClient } from "../lib/beams-client.js";
import { isDispatchTimeoutError, shouldSkipPublishBecauseAlreadyAttempted } from "../lib/notification-idempotency.js";
import { withTimeout } from "../lib/with-timeout.js";
import { getPushNotificationTargets } from "./staged-flow.service.js";

export const DISPATCH_MAX_ATTEMPTS = 5;
export const DISPATCH_DEFAULT_BATCH_SIZE = 25;
export const DISPATCH_DEFAULT_MAX_BATCHES = 4;
export const DISPATCH_FLUSH_MAX_DURATION_MS = 2_500;
export const DISPATCH_BEAMS_TIMEOUT_MS = 8_000;
export const DISPATCH_PROCESSING_STALE_SECONDS = 120;

const RETRY_BASE_DELAY_MS = 15_000;
const RETRY_MAX_DELAY_MS = 120_000;

export type DispatchBatchResult = {
  sent: number;
  failed: number;
  skipped: number;
  released: number;
};

export type DispatchResult = DispatchBatchResult & {
  batches: number;
  deadlineReached: boolean;
};

type WebNotificationPayload = {
  title: string;
  body: string;
  deep_link?: string;
  tag?: string;
};

type BeamsPublishResponse = {
  publishId?: string;
};

type DispatchOptions = {
  batchSize?: number;
  maxBatches?: number;
  maxDurationMs?: number;
};

function logDispatch(level: "INFO" | "WARN" | "ERROR", event: string, details: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      level,
      service: process.env.SERVICE_NAME ?? "pegasus-api",
      event,
      ...details,
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

export function computeRetryDelayMs(attemptCount: number): number {
  const exponent = Math.max(attemptCount - 1, 0);
  return Math.min(RETRY_BASE_DELAY_MS * 2 ** exponent, RETRY_MAX_DELAY_MS);
}

export function computeNextRetryAt(attemptCount: number, now = Date.now()): Date {
  return new Date(now + computeRetryDelayMs(attemptCount));
}

export function isNotificationReadyForDispatch(
  notification: Pick<NotificationOutbox, "status" | "attemptCount" | "nextRetryAt" | "processingStartedAt">,
  now = Date.now()
): boolean {
  if (notification.status === "PROCESSING") {
    if (!notification.processingStartedAt) {
      return false;
    }

    return now - notification.processingStartedAt.getTime() >= DISPATCH_PROCESSING_STALE_SECONDS * 1_000;
  }

  if (notification.status === "PENDING") {
    return true;
  }

  if (notification.status !== "FAILED") {
    return false;
  }

  if (notification.attemptCount >= DISPATCH_MAX_ATTEMPTS) {
    return false;
  }

  if (!notification.nextRetryAt) {
    return true;
  }

  return notification.nextRetryAt.getTime() <= now;
}

function isDeadlineReached(deadlineAt: number | null): boolean {
  return deadlineAt !== null && Date.now() >= deadlineAt;
}

async function claimNotificationBatch(limit: number): Promise<NotificationOutbox[]> {
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const claimedRows = (await manager.query(
      `
        WITH candidates AS (
          SELECT n.id, n.status AS previous_status
          FROM notification_outbox n
          WHERE (
            n.status = 'PENDING'
            OR (
              n.status = 'FAILED'
              AND n.attempt_count < $2
              AND (n.next_retry_at IS NULL OR n.next_retry_at <= NOW())
            )
            OR (
              n.status = 'PROCESSING'
              AND n.processing_started_at IS NOT NULL
              AND n.processing_started_at < NOW() - make_interval(secs => $3)
            )
          )
          ORDER BY n.created_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE notification_outbox n
        SET
          status = 'PROCESSING',
          processing_started_at = NOW(),
          updated_at = NOW()
        FROM candidates c
        WHERE n.id = c.id
        RETURNING n.id AS id, c.previous_status AS previous_status
      `,
      [limit, DISPATCH_MAX_ATTEMPTS, DISPATCH_PROCESSING_STALE_SECONDS]
    )) as Array<{ id: string; previous_status: string }>;

    if (claimedRows.length === 0) {
      return [];
    }

    for (const row of claimedRows) {
      if (row.previous_status === "PROCESSING") {
        logDispatch("WARN", "NOTIFICATION_DISPATCH_STALE_RECLAIM", {
          notificationId: row.id
        });
      }
    }

    const ids = claimedRows.map((row) => row.id);
    return manager.getRepository(NotificationOutbox).find({
      where: { id: In(ids) },
      order: { createdAt: "ASC" }
    });
  });
}

async function releaseClaim(notification: NotificationOutbox): Promise<void> {
  if (shouldSkipPublishBecauseAlreadyAttempted(notification)) {
    await markNotificationAssumedSent(notification, "deadline_after_publish_attempt");
    return;
  }

  const dataSource = await getDataSource();
  const repo = dataSource.getRepository(NotificationOutbox);

  notification.status = notification.attemptCount === 0 ? "PENDING" : "FAILED";
  notification.processingStartedAt = null;
  await repo.save(notification);

  logDispatch("INFO", "NOTIFICATION_DISPATCH_CLAIM_RELEASED", {
    notificationId: notification.id,
    attempt_count: notification.attemptCount,
    status: notification.status,
    next_retry_at: notification.nextRetryAt?.toISOString() ?? null
  });
}

async function reservePublishAttempt(notificationId: string): Promise<boolean> {
  const dataSource = await getDataSource();
  const rows = (await dataSource.query(
    `
      UPDATE notification_outbox
      SET publish_attempted_at = NOW(), updated_at = NOW()
      WHERE id = $1
        AND status = 'PROCESSING'
        AND publish_attempted_at IS NULL
      RETURNING id
    `,
    [notificationId]
  )) as Array<{ id: string }>;

  return rows.length > 0;
}

async function clearPublishAttemptForRetry(notificationId: string): Promise<void> {
  const dataSource = await getDataSource();
  await dataSource.query(
    `
      UPDATE notification_outbox
      SET publish_attempted_at = NULL, updated_at = NOW()
      WHERE id = $1
        AND status IN ('PROCESSING', 'FAILED')
    `,
    [notificationId]
  );
}

async function finalizeSentNotification(
  notification: NotificationOutbox,
  input: {
    reason: "confirmed" | "assumed";
    assumedReason?: string;
    beamsPublishId?: string | null;
  }
): Promise<boolean> {
  const dataSource = await getDataSource();
  const result = await dataSource.getRepository(NotificationOutbox).update(
    { id: notification.id, status: "PROCESSING" },
    {
      status: "SENT",
      sentAt: new Date(),
      failedAt: null,
      errorMessage: input.reason === "assumed" ? `assumed_sent:${input.assumedReason ?? "unknown"}` : null,
      processingStartedAt: null,
      nextRetryAt: null,
      beamsPublishId: input.beamsPublishId ?? null
    }
  );

  if ((result.affected ?? 0) === 0) {
    logDispatch("WARN", "NOTIFICATION_DISPATCH_ALREADY_FINALIZED", {
      notificationId: notification.id,
      reason: input.reason
    });
    return false;
  }

  return true;
}

async function markNotificationAssumedSent(
  notification: NotificationOutbox,
  assumedReason: string,
  beamsPublishId: string | null = null
): Promise<void> {
  await finalizeSentNotification(notification, {
    reason: "assumed",
    assumedReason,
    beamsPublishId
  });

  logDispatch("WARN", "NOTIFICATION_DISPATCH_ASSUMED_SENT", {
    notificationId: notification.id,
    attempt_count: notification.attemptCount,
    error: null,
    next_retry_at: null,
    assumed_reason: assumedReason,
    beams_publish_id: beamsPublishId
  });
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
    DISPATCH_BEAMS_TIMEOUT_MS,
    `Pusher Beams timeout after ${DISPATCH_BEAMS_TIMEOUT_MS}ms`
  )) as BeamsPublishResponse;

  return response.publishId ?? null;
}

async function markNotificationSent(notification: NotificationOutbox, beamsPublishId: string | null): Promise<void> {
  await finalizeSentNotification(notification, {
    reason: "confirmed",
    beamsPublishId
  });
}

async function markNotificationFailure(notification: NotificationOutbox, error: unknown): Promise<void> {
  const dataSource = await getDataSource();
  const repo = dataSource.getRepository(NotificationOutbox);
  const errorMessage = error instanceof Error ? error.message : "Error desconocido.";

  if (isDispatchTimeoutError(error)) {
    await markNotificationAssumedSent(notification, "beams_timeout");
    return;
  }

  notification.attemptCount += 1;
  notification.failedAt = new Date();
  notification.errorMessage = errorMessage;
  notification.processingStartedAt = null;
  notification.publishAttemptedAt = null;
  notification.beamsPublishId = null;
  notification.status = "FAILED";

  if (notification.attemptCount >= DISPATCH_MAX_ATTEMPTS) {
    notification.nextRetryAt = null;
    logDispatch("ERROR", "NOTIFICATION_DISPATCH_EXHAUSTED", {
      notificationId: notification.id,
      attempt_count: notification.attemptCount,
      error: errorMessage,
      next_retry_at: null
    });
  } else {
    notification.nextRetryAt = computeNextRetryAt(notification.attemptCount);
    logDispatch("WARN", "NOTIFICATION_DISPATCH_RETRY_SCHEDULED", {
      notificationId: notification.id,
      attempt_count: notification.attemptCount,
      error: errorMessage,
      next_retry_at: notification.nextRetryAt.toISOString()
    });
  }

  await repo.save(notification);
}

async function dispatchClaimedNotification(notification: NotificationOutbox): Promise<"sent" | "failed" | "skipped"> {
  if (shouldSkipPublishBecauseAlreadyAttempted(notification)) {
    await markNotificationAssumedSent(notification, "publish_already_attempted");
    return "skipped";
  }

  const dataSource = await getDataSource();
  const userIds = await getPushNotificationTargets(dataSource, notification);

  if (userIds.length === 0) {
    await markNotificationSent(notification, null);
    logDispatch("INFO", "NOTIFICATION_DISPATCH_SENT", {
      notificationId: notification.id,
      attempt_count: notification.attemptCount,
      error: null,
      next_retry_at: null,
      targetCount: 0,
      idempotent: false
    });
    return "sent";
  }

  const reserved = await reservePublishAttempt(notification.id);
  if (!reserved) {
    const latest = await dataSource.getRepository(NotificationOutbox).findOne({ where: { id: notification.id } });
    if (latest && shouldSkipPublishBecauseAlreadyAttempted(latest)) {
      await markNotificationAssumedSent(latest, "publish_reserved_by_peer");
      return "skipped";
    }

    logDispatch("WARN", "NOTIFICATION_DISPATCH_RESERVE_CONFLICT", {
      notificationId: notification.id
    });
    return "skipped";
  }

  try {
    const beamsPublishId = await publishToBeams(notification, userIds);
    await markNotificationSent(notification, beamsPublishId);
    logDispatch("INFO", "NOTIFICATION_DISPATCH_SENT", {
      notificationId: notification.id,
      attempt_count: notification.attemptCount,
      error: null,
      next_retry_at: null,
      targetCount: userIds.length,
      beams_publish_id: beamsPublishId,
      idempotent: false
    });
    return "sent";
  } catch (error) {
    if (isDispatchTimeoutError(error)) {
      await markNotificationAssumedSent(notification, "beams_timeout");
      return "skipped";
    }

    await clearPublishAttemptForRetry(notification.id);
    await markNotificationFailure(notification, error);
    return "failed";
  }
}

async function dispatchNotificationBatch(
  limit: number,
  deadlineAt: number | null
): Promise<DispatchBatchResult> {
  const notifications = await claimNotificationBatch(limit);
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let released = 0;

  for (let index = 0; index < notifications.length; index += 1) {
    const notification = notifications[index];

    if (isDeadlineReached(deadlineAt)) {
      for (let releaseIndex = index; releaseIndex < notifications.length; releaseIndex += 1) {
        await releaseClaim(notifications[releaseIndex]!);
        released += 1;
      }
      break;
    }

    const outcome = await dispatchClaimedNotification(notification);
    if (outcome === "sent" || outcome === "skipped") {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return { sent, failed, skipped, released };
}

export async function dispatchPendingNotifications(options?: DispatchOptions): Promise<DispatchResult> {
  const batchSize = options?.batchSize ?? DISPATCH_DEFAULT_BATCH_SIZE;
  const maxBatches = options?.maxBatches ?? DISPATCH_DEFAULT_MAX_BATCHES;
  const deadlineAt = options?.maxDurationMs ? Date.now() + options.maxDurationMs : null;

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let released = 0;
  let batches = 0;
  let deadlineReached = false;

  for (let index = 0; index < maxBatches; index += 1) {
    if (isDeadlineReached(deadlineAt)) {
      deadlineReached = true;
      break;
    }

    const result = await dispatchNotificationBatch(batchSize, deadlineAt);
    sent += result.sent;
    failed += result.failed;
    skipped += result.skipped;
    released += result.released;
    batches += 1;

    if (isDeadlineReached(deadlineAt)) {
      deadlineReached = true;
    }

    if (result.sent + result.failed + result.released === 0) {
      break;
    }
  }

  if (sent > 0 || failed > 0 || released > 0 || deadlineReached) {
    logDispatch("INFO", "NOTIFICATION_DISPATCH_BATCH_COMPLETE", {
      sent,
      failed,
      skipped,
      released,
      batches,
      deadlineReached
    });
  }

  return { sent, failed, skipped, released, batches, deadlineReached };
}

/**
 * Despacho acotado en tiempo para no bloquear acciones críticas de juzgamiento.
 * El cron drena el resto de la cola.
 */
export async function flushNotificationsAfterAction(): Promise<DispatchResult> {
  try {
    return await dispatchPendingNotifications({
      batchSize: 5,
      maxBatches: 2,
      maxDurationMs: DISPATCH_FLUSH_MAX_DURATION_MS
    });
  } catch (error) {
    logDispatch("ERROR", "NOTIFICATION_DISPATCH_FLUSH_FAILED", {
      error: error instanceof Error ? error.message : "Error desconocido."
    });

    return {
      sent: 0,
      failed: 0,
      skipped: 0,
      released: 0,
      batches: 0,
      deadlineReached: false
    };
  }
}

/** @deprecated Usar dispatchPendingNotifications */
export async function processPendingNotifications(limit = DISPATCH_DEFAULT_BATCH_SIZE): Promise<{
  sent: number;
  failed: number;
}> {
  const result = await dispatchPendingNotifications({ batchSize: limit, maxBatches: 1 });
  return { sent: result.sent, failed: result.failed };
}
