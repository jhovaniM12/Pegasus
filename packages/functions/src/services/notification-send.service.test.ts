import { describe, expect, it } from "vitest";
import type { NotificationOutbox } from "@pegasus/core";
import { buildBeamsPayload } from "./notification-send.service.js";

function notification(
  overrides: Partial<Pick<NotificationOutbox, "id" | "type" | "title" | "body" | "payload">> = {}
) {
  return {
    id: "notification-user-1",
    type: "PRE_RING_STARTED",
    title: "Pre-pista iniciada",
    body: "Ya puedes realizar el chequeo",
    payload: {
      deepLink: "/staff/categories/stage-1?view=PRERING",
      fairName: "Villeta",
      categoryName: "Yeguas",
      gaitName: "Trocha",
    },
    ...overrides,
  };
}

describe("buildBeamsPayload", () => {
  it("incluye la identidad y todos los datos necesarios para el toast inmediato", () => {
    expect(buildBeamsPayload(notification())).toMatchObject({
      web: {
        notification: {
          title: "Pre-pista iniciada",
          body: "Ya puedes realizar el chequeo",
          tag: "notification-user-1",
        },
        data: {
          kind: "INBOX_NOTIFICATION",
          notificationId: "notification-user-1",
          notificationType: "PRE_RING_STARTED",
          title: "Pre-pista iniciada",
          body: "Ya puedes realizar el chequeo",
          deepLink: "/staff/categories/stage-1?view=PRERING",
          fairName: "Villeta",
          categoryName: "Yeguas",
          gaitName: "Trocha",
        },
      },
    });
  });

  it("normaliza deep links relativos y usa valores seguros si falta contexto", () => {
    expect(
      buildBeamsPayload(
        notification({
          id: "notification-user-2",
          payload: { deepLink: "staff/categories/stage-2" },
        })
      ).web.data
    ).toEqual({
      kind: "INBOX_NOTIFICATION",
      notificationId: "notification-user-2",
      notificationType: "PRE_RING_STARTED",
      title: "Pre-pista iniciada",
      body: "Ya puedes realizar el chequeo",
      deepLink: "/staff/categories/stage-2",
      fairName: "",
      categoryName: "",
      gaitName: "",
    });
  });
});
