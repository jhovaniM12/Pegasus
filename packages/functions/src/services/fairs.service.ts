import {
  findFairById,
  findFairEntriesByFairId,
  findFairResultsByFairId,
  findFairsPaginated,
  findFairStaffByFairId,
  getDataSource,
  summarizeFairEntriesByGait,
  type FairEntriesGaitSummary,
  type PaginatedResult,
  type PaginationParams
} from "@pegasus/core";
import type { Fair } from "@pegasus/core";
import type { FairEntry } from "@pegasus/core";
import type { FairResult } from "@pegasus/core";
import type { FairStaff } from "@pegasus/core";
import { NotFoundError } from "../lib/errors.js";

async function getFairOrThrow(fairId: string): Promise<Fair> {
  const dataSource = await getDataSource();
  const fair = await findFairById(dataSource, fairId);

  if (!fair) {
    throw new NotFoundError(`No se encontró la feria con id "${fairId}".`);
  }

  return fair;
}

export async function listFairs(
  params: PaginationParams
): Promise<PaginatedResult<Fair>> {
  const dataSource = await getDataSource();
  return findFairsPaginated(dataSource, params);
}

export async function getFairById(fairId: string): Promise<Fair> {
  return getFairOrThrow(fairId);
}

export async function listFairEntries(
  fairId: string,
  params: PaginationParams & { search?: string; categoryId?: string }
): Promise<PaginatedResult<FairEntry>> {
  await getFairOrThrow(fairId);
  const dataSource = await getDataSource();
  return findFairEntriesByFairId(dataSource, fairId, params);
}

export async function getFairEntriesSummary(
  fairId: string
): Promise<FairEntriesGaitSummary[]> {
  await getFairOrThrow(fairId);
  const dataSource = await getDataSource();
  return summarizeFairEntriesByGait(dataSource, fairId);
}

export async function listFairResults(
  fairId: string,
  params: PaginationParams & { categoryId?: string }
): Promise<PaginatedResult<FairResult>> {
  await getFairOrThrow(fairId);
  const dataSource = await getDataSource();
  return findFairResultsByFairId(dataSource, fairId, params);
}

export async function listFairStaff(
  fairId: string,
  params: PaginationParams
): Promise<PaginatedResult<FairStaff>> {
  await getFairOrThrow(fairId);
  const dataSource = await getDataSource();
  return findFairStaffByFairId(dataSource, fairId, params);
}
