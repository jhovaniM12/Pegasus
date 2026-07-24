import { describe, expect, it } from "vitest";
import { parseStaffPushMessage } from "./staff-push-message";

describe("parseStaffPushMessage", () => {
  it("parsea notificaciones de inbox con payload completo", () => {
    expect(
      parseStaffPushMessage({
        type: "PUSH_RECEIVED",
        kind: "INBOX_NOTIFICATION",
        notificationId: "n-1",
        notificationType: "PRE_RING_STARTED",
        title: "Pre-pista iniciada",
        body: "Ya puedes chequear",
        deepLink: "/staff/categories/s-1",
        fairName: "Villeta",
        categoryName: "Yeguas",
        gaitName: "Trocha",
      })
    ).toEqual({
      kind: "INBOX_NOTIFICATION",
      notificationId: "n-1",
      notificationType: "PRE_RING_STARTED",
      title: "Pre-pista iniciada",
      body: "Ya puedes chequear",
      deepLink: "/staff/categories/s-1",
      fairName: "Villeta",
      categoryName: "Yeguas",
      gaitName: "Trocha",
    });
  });

  it("parsea señales de refresh y el formato legacy", () => {
    expect(
      parseStaffPushMessage({
        type: "PUSH_RECEIVED",
        kind: "STAFF_REFRESH",
        fairCategoryStageId: "stage-1",
      })
    ).toEqual({
      kind: "STAFF_REFRESH",
      fairCategoryStageId: "stage-1",
    });

    expect(parseStaffPushMessage({ type: "PUSH_RECEIVED" })).toEqual({ kind: "UNKNOWN" });
    expect(parseStaffPushMessage({ type: "OTHER" })).toBeNull();
  });
});
