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
import type { Fair, FairEntry, FairResult } from "@pegasus/core";
import { FairStaff } from "@pegasus/core";
import { BadRequestError, ConflictError, NotFoundError } from "../lib/errors.js";

const JUDGE_ROLE_EXTERNAL_ID = "2";

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

/**
 * Asigna o limpia el asiento fijo (Juez 1–5) de un miembro del staff.
 * Si el asiento ya está ocupado, intercambia asientos con el ocupante.
 */
export async function updateFairStaffJudgeSeat(
  fairId: string,
  staffId: string,
  judgeSeat: number | null
): Promise<FairStaff> {
  await getFairOrThrow(fairId);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const staffRepo = manager.getRepository(FairStaff);
    const staff = await staffRepo.findOne({
      where: { id: staffId, fairId },
      relations: { person: true, role: true }
    });

    if (!staff) {
      throw new NotFoundError(`No se encontró el staff "${staffId}" en esta feria.`);
    }

    if (staff.role.externalId !== JUDGE_ROLE_EXTERNAL_ID) {
      throw new BadRequestError("Solo se puede asignar asiento a personal con rol de juez.");
    }

    if (judgeSeat === staff.judgeSeat) {
      return staff;
    }

    if (judgeSeat != null) {
      const occupant = await staffRepo.findOne({
        where: { fairId, judgeSeat },
        relations: { person: true, role: true }
      });

      if (occupant && occupant.id !== staff.id) {
        const previousSeat = staff.judgeSeat;
        // Liberar temporalmente para respetar el unique parcial (fair_id, judge_seat).
        occupant.judgeSeat = null;
        await staffRepo.save(occupant);
        staff.judgeSeat = judgeSeat;
        await staffRepo.save(staff);
        occupant.judgeSeat = previousSeat;
        await staffRepo.save(occupant);
        return staff;
      }
    }

    try {
      staff.judgeSeat = judgeSeat;
      return await staffRepo.save(staff);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("UQ_fair_staff_fair_judge_seat")) {
        throw new ConflictError(
          `El asiento Juez ${judgeSeat} ya está asignado en esta feria.`,
          "JUDGE_SEAT_TAKEN"
        );
      }
      throw error;
    }
  });
}
