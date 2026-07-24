import type { EntityManager } from "typeorm";
import { describe, expect, it, vi } from "vitest";
import {
  listStagesForAssignedStaff,
  listStagesFromFairEntries
} from "./staged-flow.service.js";

function queryManager() {
  const query = {
    innerJoin: vi.fn().mockReturnThis(),
    innerJoinAndSelect: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    addGroupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    getRawMany: vi.fn(async () => []),
    getMany: vi.fn(async () => [])
  };
  const manager = {
    getRepository: vi.fn(() => ({
      createQueryBuilder: vi.fn(() => query)
    }))
  } as unknown as EntityManager;

  return { manager, query };
}

function expectGroupExclusion(query: ReturnType<typeof queryManager>["query"]): void {
  expect(query.andWhere).toHaveBeenCalledWith(
    expect.stringMatching(/category\.external_id.*NOT IN/),
    { groupCategoryExternalIds: ["GYCC", "GYPC"] }
  );
}

describe("exclusión SQL de etapas grupales", () => {
  it("evita crear etapas grupales desde inscripciones", async () => {
    const { manager, query } = queryManager();

    await expect(listStagesFromFairEntries(manager, "person-id", "3")).resolves.toEqual([]);

    expectGroupExclusion(query);
    expect(query.getRawMany).toHaveBeenCalledOnce();
  });

  it("evita mostrar etapas grupales existentes al staff", async () => {
    const { manager, query } = queryManager();

    await expect(
      listStagesForAssignedStaff(manager, "person-id", "2", "ANY_STARTED")
    ).resolves.toEqual([]);

    expectGroupExclusion(query);
    expect(query.getMany).toHaveBeenCalledOnce();
  });
});
