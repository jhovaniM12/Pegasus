export type StaffPushInboxPayload = {
  kind: "INBOX_NOTIFICATION";
  notificationId: string | null;
  notificationType: string | null;
  title: string | null;
  body: string | null;
  deepLink: string | null;
  fairName: string | null;
  categoryName: string | null;
  gaitName: string | null;
};

export type StaffPushRefreshPayload = {
  kind: "STAFF_REFRESH";
  fairCategoryStageId: string | null;
};

export type StaffPushMessage =
  | StaffPushInboxPayload
  | StaffPushRefreshPayload
  | { kind: "UNKNOWN" };

export function parseStaffPushMessage(data: unknown): StaffPushMessage | null {
  if (!data || typeof data !== "object") return null;
  const value = data as Record<string, unknown>;
  if (value.type !== "PUSH_RECEIVED") return null;

  if (value.kind === "STAFF_REFRESH") {
    return {
      kind: "STAFF_REFRESH",
      fairCategoryStageId:
        typeof value.fairCategoryStageId === "string" ? value.fairCategoryStageId : null,
    };
  }

  if (value.kind === "INBOX_NOTIFICATION") {
    return {
      kind: "INBOX_NOTIFICATION",
      notificationId: typeof value.notificationId === "string" ? value.notificationId : null,
      notificationType:
        typeof value.notificationType === "string" ? value.notificationType : null,
      title: typeof value.title === "string" ? value.title : null,
      body: typeof value.body === "string" ? value.body : null,
      deepLink: typeof value.deepLink === "string" ? value.deepLink : null,
      fairName: typeof value.fairName === "string" ? value.fairName : null,
      categoryName: typeof value.categoryName === "string" ? value.categoryName : null,
      gaitName: typeof value.gaitName === "string" ? value.gaitName : null,
    };
  }

  // Compatibilidad con SW antiguo que solo enviaba `{ type: "PUSH_RECEIVED" }`.
  return { kind: "UNKNOWN" };
}
