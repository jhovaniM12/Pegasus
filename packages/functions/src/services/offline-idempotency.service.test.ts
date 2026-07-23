import type { EntityManager } from "typeorm";
import { describe, expect, it, vi } from "vitest";
import {
  IdempotencyKeyReusedError,
  RevisionConflictError,
} from "../lib/errors.js";
import {
  assertExpectedRevision,
  buildOfflineRequestHash,
  executeIdempotentMutation,
  type IdempotentMutationInput,
} from "./offline-idempotency.service.js";

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const STAGE_ID = "33333333-3333-4333-8333-333333333333";
const FORM_ID = "44444444-4444-4444-8444-444444444444";

function mutationInput(
  apply: IdempotentMutationInput<{ selectedParticipantIds: string[] }>["apply"]
): IdempotentMutationInput<{ selectedParticipantIds: string[] }> {
  return {
    operationId: OPERATION_ID,
    userId: USER_ID,
    stageId: STAGE_ID,
    aggregateType: "FA_FORM",
    aggregateId: FORM_ID,
    operationType: "UPDATE_FA_SELECTION",
    baseRevision: 2,
    requestPayload: { selectedParticipantIds: ["participant-1"] },
    apply,
  };
}

function managerWithRepository(repository: object): EntityManager {
  return {
    queryRunner: { isTransactionActive: true },
    query: vi.fn().mockResolvedValue(undefined),
    getRepository: vi.fn().mockReturnValue(repository),
  } as unknown as EntityManager;
}

function requestHashForInput(
  input: IdempotentMutationInput<{ selectedParticipantIds: string[] }>
): string {
  return buildOfflineRequestHash({
    userId: input.userId,
    stageId: input.stageId,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    operationType: input.operationType,
    baseRevision: input.baseRevision,
    requestPayload: input.requestPayload,
  });
}

describe("offline idempotency", () => {
  it("genera el mismo hash para objetos equivalentes con distinto orden", () => {
    const shared = {
      userId: USER_ID,
      stageId: STAGE_ID,
      aggregateType: "FA_FORM" as const,
      aggregateId: FORM_ID,
      operationType: "UPDATE_FA_SELECTION",
      baseRevision: 2,
    };

    expect(
      buildOfflineRequestHash({
        ...shared,
        requestPayload: { selectedParticipantIds: ["a"], nested: { b: 2, a: 1 } },
      })
    ).toBe(
      buildOfflineRequestHash({
        ...shared,
        requestPayload: { nested: { a: 1, b: 2 }, selectedParticipantIds: ["a"] },
      })
    );
  });

  it("aplica y guarda una operación nueva una sola vez", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const repository = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((value) => value),
      save,
    };
    const apply = vi.fn().mockResolvedValue({
      responsePayload: { selectedParticipantIds: ["participant-1"] },
      appliedRevision: 3,
    });

    const result = await executeIdempotentMutation(
      managerWithRepository(repository),
      mutationInput(apply)
    );

    expect(result).toMatchObject({ duplicate: false, appliedRevision: 3, responseStatus: 200 });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("devuelve el recibo previo sin repetir efectos", async () => {
    const apply = vi.fn();
    const input = mutationInput(apply);
    const repository = {
      findOne: vi.fn().mockResolvedValue({
        operationId: OPERATION_ID,
        requestHash: requestHashForInput(input),
        responsePayload: { selectedParticipantIds: ["participant-1"] },
        responseStatus: 200,
        appliedRevision: 3,
      }),
      create: vi.fn(),
      save: vi.fn(),
    };

    const result = await executeIdempotentMutation(managerWithRepository(repository), input);

    expect(result.duplicate).toBe(true);
    expect(result.appliedRevision).toBe(3);
    expect(apply).not.toHaveBeenCalled();
  });

  it("rechaza reutilizar operationId con otro contenido", async () => {
    const input = mutationInput(vi.fn());
    const repository = {
      findOne: vi.fn().mockResolvedValue({
        operationId: OPERATION_ID,
        requestHash: "different-request-hash",
      }),
      create: vi.fn(),
      save: vi.fn(),
    };

    await expect(
      executeIdempotentMutation(managerWithRepository(repository), input)
    ).rejects.toBeInstanceOf(IdempotencyKeyReusedError);
  });

  it("expone un conflicto estructurado cuando la revisión cambió", () => {
    expect(() =>
      assertExpectedRevision(2, 4, {
        aggregateId: FORM_ID,
        currentState: { status: "STARTED" },
        resolution: "CAN_REAPPLY_LOCAL_DRAFT",
      })
    ).toThrowError(RevisionConflictError);

    try {
      assertExpectedRevision(2, 4, {
        aggregateId: FORM_ID,
        currentState: { status: "STARTED" },
        resolution: "CAN_REAPPLY_LOCAL_DRAFT",
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "REVISION_CONFLICT",
        statusCode: 409,
        details: {
          aggregateId: FORM_ID,
          expectedRevision: 2,
          currentRevision: 4,
          resolution: "CAN_REAPPLY_LOCAL_DRAFT",
        },
      });
    }
  });
});
