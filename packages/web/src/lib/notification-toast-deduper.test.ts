import { describe, expect, it } from "vitest";
import { NotificationToastDeduper } from "./notification-toast-deduper";

const notification = {
  type: "PRE_RING_STARTED",
  title: "Pre-pista iniciada",
  body: "Ya puedes realizar el chequeo",
};

describe("NotificationToastDeduper", () => {
  it("muestra una entrega una sola vez cuando push y fetch traen el mismo ID", () => {
    const deduper = new NotificationToastDeduper();

    expect(deduper.shouldShow({ ...notification, id: "notification-1" })).toBe(true);
    expect(deduper.shouldShow({ ...notification, id: "notification-1" })).toBe(false);
  });

  it("deduplica temporalmente la carrera entre payload legacy y fetch", () => {
    let now = 1_000;
    const deduper = new NotificationToastDeduper({
      contentWindowMs: 5_000,
      now: () => now,
    });

    expect(deduper.shouldShow(notification)).toBe(true);
    expect(deduper.shouldShow({ ...notification, id: "notification-1" })).toBe(false);

    now += 5_001;
    expect(deduper.shouldShow({ ...notification, id: "notification-1" })).toBe(true);
  });

  it("permite eventos legítimos con contenido idéntico después de la ventana corta", () => {
    let now = 10_000;
    const deduper = new NotificationToastDeduper({
      contentWindowMs: 5_000,
      now: () => now,
    });

    expect(deduper.shouldShow({ ...notification, id: "notification-1" })).toBe(true);
    now += 5_001;
    expect(deduper.shouldShow({ ...notification, id: "notification-2" })).toBe(true);
  });

  it("no permite que un ID repetido reaparezca al expirar la huella de contenido", () => {
    let now = 20_000;
    const deduper = new NotificationToastDeduper({
      contentWindowMs: 100,
      idRetentionMs: 10_000,
      now: () => now,
    });

    expect(deduper.shouldShow({ ...notification, id: "notification-1" })).toBe(true);
    now += 101;
    expect(deduper.shouldShow({ ...notification, id: "notification-1" })).toBe(false);
  });

  it("mantiene acotado el almacenamiento interno sin romper entregas nuevas", () => {
    const deduper = new NotificationToastDeduper({ maxEntries: 4 });

    for (let index = 0; index < 10; index += 1) {
      expect(
        deduper.shouldShow({
          ...notification,
          id: `notification-${index}`,
          body: `Mensaje ${index}`,
        })
      ).toBe(true);
    }
  });
});
