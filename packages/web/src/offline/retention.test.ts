import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { closeOfflineDatabase, getOfflineDatabase } from "./db";
import {
  confirmOfflineMutation,
  queueOfflineMutation,
  trustOfflineDevice,
} from "./offline-repository";
import {
  getOfflineSyncMetrics,
  prepareStaffLogoutOffline,
  purgeExpiredOfflineConfirmations,
} from "./retention";
import { recordOfflineTelemetry, setOfflineTelemetrySink } from "./telemetry";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const STAGE_ID = "33333333-3333-4333-8333-333333333333";
const FORM_ID = "44444444-4444-4444-8444-444444444444";

afterEach(async () => {
  setOfflineTelemetrySink(null);
  await getOfflineDatabase().delete();
  await closeOfflineDatabase();
});

describe("offline retention and telemetry", () => {
  it("purga confirmaciones expiradas y reporta métricas", async () => {
    await confirmOfflineMutation({
      operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      userId: USER_ID,
      stageId: STAGE_ID,
      aggregateId: FORM_ID,
      appliedRevision: 2,
      responsePayload: { ok: true },
      confirmedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    });

    await expect(purgeExpiredOfflineConfirmations()).resolves.toBe(1);
    await expect(getOfflineDatabase().offlineConfirmations.count()).resolves.toBe(0);
  });

  it("bloquea limpieza al logout si hay pendientes", async () => {
    await trustOfflineDevice(USER_ID, new Date(Date.now() + 60_000).toISOString());
    await queueOfflineMutation({
      deduplicationKey: `FA_FORM:${STAGE_ID}:${FORM_ID}`,
      userId: USER_ID,
      stageId: STAGE_ID,
      aggregateType: "FA_FORM",
      aggregateId: FORM_ID,
      operationType: "UPDATE_FA_SELECTION",
      baseRevision: 1,
      payload: { selectedParticipantIds: [] },
    });

    await expect(prepareStaffLogoutOffline(USER_ID)).resolves.toEqual({
      blockedByPending: true,
      pendingCount: 1,
    });
    await expect(getOfflineSyncMetrics(USER_ID)).resolves.toMatchObject({
      pendingCount: 1,
    });
  });

  it("emite telemetría sin incluir payload de tarjeta", () => {
    const events: unknown[] = [];
    setOfflineTelemetrySink((event) => {
      events.push(event);
    });

    recordOfflineTelemetry("OFFLINE_SYNC_BATCH_COMPLETED", {
      userId: USER_ID,
      stageId: STAGE_ID,
      syncedCount: 2,
      conflictCount: 0,
      failedCount: 0,
      durationMs: 120,
    });

    expect(events).toHaveLength(1);
    expect(JSON.stringify(events[0])).not.toContain("selectedParticipantIds");
    expect(events[0]).toMatchObject({
      name: "OFFLINE_SYNC_BATCH_COMPLETED",
      syncedCount: 2,
    });
  });
});
