import { describe, expect, it } from "vitest";
import {
  computeNextRetryAt,
  computeRetryDelayMs,
  DISPATCH_MAX_ATTEMPTS,
  DISPATCH_PROCESSING_STALE_SECONDS,
  isNotificationReadyForDispatch
} from "./notification-dispatch.service.js";

describe("notification-dispatch.service", () => {
  it("prioriza pendientes inmediatamente", () => {
    expect(
      isNotificationReadyForDispatch({
        status: "PENDING",
        attemptCount: 0,
        nextRetryAt: null,
        processingStartedAt: null
      })
    ).toBe(true);
  });

  it("no despacha processing vigente", () => {
    expect(
      isNotificationReadyForDispatch({
        status: "PROCESSING",
        attemptCount: 0,
        nextRetryAt: null,
        processingStartedAt: new Date()
      })
    ).toBe(false);
  });

  it("reclama processing stale", () => {
    const now = Date.UTC(2026, 5, 23, 12, 0, 0);

    expect(
      isNotificationReadyForDispatch(
        {
          status: "PROCESSING",
          attemptCount: 1,
          nextRetryAt: null,
          processingStartedAt: new Date(now - DISPATCH_PROCESSING_STALE_SECONDS * 1_000 - 1)
        },
        now
      )
    ).toBe(true);
  });

  it("reintenta fallidas solo después de next_retry_at", () => {
    const now = Date.UTC(2026, 5, 23, 12, 0, 0);

    expect(
      isNotificationReadyForDispatch(
        {
          status: "FAILED",
          attemptCount: 1,
          nextRetryAt: new Date(now + 10_000),
          processingStartedAt: null
        },
        now
      )
    ).toBe(false);

    expect(
      isNotificationReadyForDispatch(
        {
          status: "FAILED",
          attemptCount: 1,
          nextRetryAt: new Date(now - 1_000),
          processingStartedAt: null
        },
        now
      )
    ).toBe(true);
  });

  it("no reintenta cuando se agotaron los intentos", () => {
    expect(
      isNotificationReadyForDispatch({
        status: "FAILED",
        attemptCount: DISPATCH_MAX_ATTEMPTS,
        nextRetryAt: null,
        processingStartedAt: null
      })
    ).toBe(false);
  });

  it("aplica backoff exponencial acotado", () => {
    expect(computeRetryDelayMs(1)).toBe(15_000);
    expect(computeRetryDelayMs(2)).toBe(30_000);
    expect(computeRetryDelayMs(5)).toBe(120_000);
  });

  it("calcula next_retry_at a partir del intento", () => {
    const now = Date.UTC(2026, 5, 23, 12, 0, 0);
    expect(computeNextRetryAt(2, now).toISOString()).toBe(new Date(now + 30_000).toISOString());
  });
});
