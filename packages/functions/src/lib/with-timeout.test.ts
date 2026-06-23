import { describe, expect, it } from "vitest";
import { withTimeout } from "../lib/with-timeout.js";

describe("withTimeout", () => {
  it("resuelve cuando la promesa termina a tiempo", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 100, "timeout")).resolves.toBe("ok");
  });

  it("rechaza cuando se agota el tiempo", async () => {
    await expect(
      withTimeout(new Promise<string>(() => undefined), 20, "Pusher Beams timeout after 20ms")
    ).rejects.toThrow("Pusher Beams timeout after 20ms");
  });
});
