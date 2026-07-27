import { describe, expect, it } from "vitest";
import { updateVeterinaryCheckSchema } from "../schemas/staged-flow.schema.js";

describe("updateVeterinaryCheckSchema", () => {
  it("acepta el contrato legacy y el sobre offline", () => {
    expect(
      updateVeterinaryCheckSchema.parse({
        status: "APPROVED",
        notes: "ok",
      })
    ).toEqual({
      status: "APPROVED",
      notes: "ok",
    });

    const envelope = updateVeterinaryCheckSchema.parse({
      operationId: "11111111-1111-4111-8111-111111111111",
      baseRevision: 2,
      clientUpdatedAt: "2026-07-23T16:00:00.000Z",
      payload: {
        status: "REJECTED",
        notes: null,
        rejectionReasonId: "22222222-2222-4222-8222-222222222222",
      },
    });

    expect(envelope).toMatchObject({
      operationId: "11111111-1111-4111-8111-111111111111",
      baseRevision: 2,
      payload: {
        status: "REJECTED",
        notes: null,
        rejectionReasonId: "22222222-2222-4222-8222-222222222222",
      },
    });
  });

  it("exige rejectionReasonId cuando el estado es REJECTED", () => {
    expect(() =>
      updateVeterinaryCheckSchema.parse({
        status: "REJECTED",
        notes: null,
      })
    ).toThrow();
  });
});
