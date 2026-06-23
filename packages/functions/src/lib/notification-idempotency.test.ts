import { describe, expect, it } from "vitest";
import { isDispatchTimeoutError, shouldSkipPublishBecauseAlreadyAttempted } from "./notification-idempotency.js";

describe("notification-idempotency", () => {
  it("bloquea republicación si ya hubo intento registrado", () => {
    expect(
      shouldSkipPublishBecauseAlreadyAttempted({
        publishAttemptedAt: new Date(),
        status: "PROCESSING"
      })
    ).toBe(true);
  });

  it("permite publicar si no hay intento previo", () => {
    expect(
      shouldSkipPublishBecauseAlreadyAttempted({
        publishAttemptedAt: null,
        status: "PROCESSING"
      })
    ).toBe(false);
  });

  it("detecta timeout de Beams", () => {
    expect(isDispatchTimeoutError(new Error("Pusher Beams timeout after 8000ms"))).toBe(true);
    expect(isDispatchTimeoutError(new Error("network error"))).toBe(false);
  });
});
