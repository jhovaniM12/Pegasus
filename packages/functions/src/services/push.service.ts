import PushNotifications from "@pusher/push-notifications-server";
import { getDataSource, NotificationOutbox, type User } from "@pegasus/core";
import { NotFoundError } from "../lib/errors.js";
import { getPushNotificationTargets } from "./staged-flow.service.js";

type BeamsClient = InstanceType<typeof PushNotifications>;

let beamsClient: BeamsClient | null = null;

function getBeamsClient(): BeamsClient {
  if (beamsClient) {
    return beamsClient;
  }

  const instanceId = process.env.PUSHER_BEAMS_INSTANCE_ID;
  const secretKey = process.env.PUSHER_BEAMS_PRIMARY_KEY;

  if (!instanceId || !secretKey) {
    throw new Error("PUSHER_BEAMS_INSTANCE_ID y PUSHER_BEAMS_PRIMARY_KEY son requeridos.");
  }

  beamsClient = new PushNotifications({ instanceId, secretKey });
  return beamsClient;
}

export function generateBeamsToken(user: User) {
  return getBeamsClient().generateToken(user.id);
}

function notificationDeepLink(notification: NotificationOutbox): string | null {
  return typeof notification.payload?.deepLink === "string" ? notification.payload.deepLink : null;
}

function toInboxNotification(notification: NotificationOutbox) {
  const payload = notification.payload as Record<string, unknown> | null;

  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    deepLink: notificationDeepLink(notification),
    fairName: typeof payload?.fairName === "string" ? payload.fairName : null,
    categoryName: typeof payload?.categoryName === "string" ? payload.categoryName : null,
    gaitName: typeof payload?.gaitName === "string" ? payload.gaitName : null,
    readAt: notification.readAt?.toISOString() ?? null,
    archivedAt: notification.archivedAt?.toISOString() ?? null,
    sentAt: notification.sentAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString()
  };
}

export async function listInboxNotifications(user: User, limitInput = 20) {
  const dataSource = await getDataSource();
  const limit = Math.min(Math.max(Number.isFinite(limitInput) ? Math.trunc(limitInput) : 20, 1), 50);
  const repo = dataSource.getRepository(NotificationOutbox);
  const [notifications, unreadCount] = await Promise.all([
    repo
      .createQueryBuilder("notification")
      .where("notification.recipient_user_id = :userId", { userId: user.id })
      .andWhere("notification.archived_at IS NULL")
      .orderBy("notification.created_at", "DESC")
      .take(limit)
      .getMany(),
    repo
      .createQueryBuilder("notification")
      .where("notification.recipient_user_id = :userId", { userId: user.id })
      .andWhere("notification.archived_at IS NULL")
      .andWhere("notification.read_at IS NULL")
      .getCount()
  ]);

  return {
    unreadCount,
    notifications: notifications.map(toInboxNotification)
  };
}

async function getOwnedInboxNotification(user: User, notificationId: string): Promise<NotificationOutbox> {
  const dataSource = await getDataSource();
  const notification = await dataSource.getRepository(NotificationOutbox).findOne({
    where: { id: notificationId, recipientUserId: user.id }
  });

  if (!notification) {
    throw new NotFoundError("No se encontro la notificacion.");
  }

  return notification;
}

export async function markInboxNotificationRead(user: User, notificationId: string) {
  const dataSource = await getDataSource();
  const notification = await getOwnedInboxNotification(user, notificationId);

  if (!notification.readAt) {
    notification.readAt = new Date();
    await dataSource.getRepository(NotificationOutbox).save(notification);
  }

  return toInboxNotification(notification);
}

export async function markAllInboxNotificationsRead(user: User) {
  const dataSource = await getDataSource();
  await dataSource
    .getRepository(NotificationOutbox)
    .createQueryBuilder()
    .update(NotificationOutbox)
    .set({ readAt: new Date() })
    .where("recipient_user_id = :userId", { userId: user.id })
    .andWhere("archived_at IS NULL")
    .andWhere("read_at IS NULL")
    .execute();

  return listInboxNotifications(user);
}

export async function archiveInboxNotification(user: User, notificationId: string) {
  const dataSource = await getDataSource();
  const notification = await getOwnedInboxNotification(user, notificationId);

  if (!notification.archivedAt) {
    notification.archivedAt = new Date();
    await dataSource.getRepository(NotificationOutbox).save(notification);
  }

  return { id: notification.id, archivedAt: notification.archivedAt.toISOString() };
}

export async function processPendingNotifications(limit = 25): Promise<{ sent: number; failed: number }> {
  const dataSource = await getDataSource();
  const repo = dataSource.getRepository(NotificationOutbox);
  const notifications = await repo.find({
    where: { status: "PENDING" },
    order: { createdAt: "ASC" },
    take: limit
  });
  let sent = 0;
  let failed = 0;

  for (const notification of notifications) {
    try {
      const userIds = await getPushNotificationTargets(dataSource, notification);

      if (userIds.length === 0) {
        notification.status = "SENT";
        notification.sentAt = new Date();
        await repo.save(notification);
        sent += 1;
        continue;
      }

      await getBeamsClient().publishToUsers(userIds, {
        web: {
          notification: {
            title: notification.title,
            body: notification.body,
            deep_link:
              typeof notification.payload?.deepLink === "string"
                ? notification.payload.deepLink
                : "/staff"
          }
        }
      });

      notification.status = "SENT";
      notification.sentAt = new Date();
      notification.errorMessage = null;
      await repo.save(notification);
      sent += 1;
    } catch (error) {
      notification.status = "FAILED";
      notification.failedAt = new Date();
      notification.errorMessage = error instanceof Error ? error.message : "Error desconocido.";
      await repo.save(notification);
      failed += 1;
    }
  }

  return { sent, failed };
}
