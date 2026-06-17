import {
  AwardDistinctive,
  DisqualificationReason,
  FaConsolidatedResult,
  FairCategoryStage,
  getDataSource,
  JudgingParticipant,
  JudgingRound,
  JudgingRoundDesertedResult,
  JudgingRoundEntry,
  JudgingRoundForm,
  JudgingRoundFormDesertedPosition,
  JudgingRoundResult,
  TieBreakTest,
  User,
  type JudgingParticipantStatus,
  type JudgingRoundResultStatus,
  MAX_AWARD_POSITIONS,
  type JudgingRoundType,
  type TieBreakTestType
} from "@pegasus/core";
import type { EntityManager } from "typeorm";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../lib/errors.js";
import { buildStageSummary, type StagedCategoryDto } from "../staged-flow.service.js";
import { resolveAwardDistinctiveForPosition } from "./award-distinctives.js";
import { computeF2, type JudgeCard } from "./scoring.js";
import {
  loadActiveReminders,
  loadReminderHistory,
  loadRemindersByEntryIds,
  type EntryReminderDto,
  type ReminderHistoryItemDto
} from "./round-entry-annotations.service.js";
import {
  ROLE_LABELS,
  assertStageAccess,
  assertUserRole,
  getStageOrThrow,
  getUsersByFairRole,
  queueRoleNotifications,
  recordEvent,
  stageNotificationContext
} from "./shared.js";

const MAX_F1_SELECTIONS = 7;
const F1_SURVIVOR_THRESHOLD = 8;
const MIN_AWARD_POSITION = 1;

export const TIE_BREAK_TEST_LABELS: Record<TieBreakTestType, string> = {
  DOUBLE_TABLE: "Doble tabla",
  DIRECTION_CHANGE: "Cambios de dirección",
  PARALLEL: "Paralelo",
  CIRCLES: "Círculos",
  STOP_AND_GO: "Pare y siga",
  GAIT_CHANGE: "Cambio de andar",
  MOUNT: "Montar ejemplares"
};

// ─── Lecturas auxiliares ────────────────────────────────────────────────────

async function getLatestRound(
  manager: EntityManager,
  stageId: string,
  type?: JudgingRoundType
): Promise<JudgingRound | null> {
  return manager.getRepository(JudgingRound).findOne({
    where: type ? { fairCategoryStageId: stageId, roundType: type } : { fairCategoryStageId: stageId },
    order: { createdAt: "DESC" }
  });
}

async function getActiveRoundOrThrow(manager: EntityManager, stageId: string): Promise<JudgingRound> {
  const round = await manager.getRepository(JudgingRound).findOne({
    where: { fairCategoryStageId: stageId, status: "OPEN" },
    order: { createdAt: "DESC" }
  });

  if (!round) {
    throw new BadRequestError("No hay una ronda activa para esta categoría.");
  }

  return round;
}

async function loadParticipants(manager: EntityManager, participantIds: string[]) {
  if (participantIds.length === 0) return [];
  return manager.getRepository(JudgingParticipant).find({
    where: participantIds.map((id) => ({ id })),
    relations: { fairEntry: true, disqualificationReason: true }
  });
}

async function loadParticipantStatusMap(
  manager: EntityManager,
  participantIds: string[]
): Promise<Map<string, JudgingParticipantStatus>> {
  if (participantIds.length === 0) return new Map();
  const rows = await manager.getRepository(JudgingParticipant).find({
    where: participantIds.map((id) => ({ id })),
    select: { id: true, status: true }
  });
  return new Map(rows.map((row) => [row.id, row.status]));
}

async function loadActiveDisqualificationReasons(manager: EntityManager) {
  const reasons = await manager.getRepository(DisqualificationReason).find({
    where: { isActive: true },
    order: { code: "ASC" }
  });
  return reasons.map((reason) => ({
    id: reason.id,
    code: reason.code,
    name: reason.name,
    description: reason.description
  }));
}

async function clearParticipantRoundAssignments(
  manager: EntityManager,
  roundId: string,
  participantId: string
): Promise<void> {
  const forms = await manager.getRepository(JudgingRoundForm).find({ where: { roundId } });
  for (const roundForm of forms) {
    const entries = await manager.getRepository(JudgingRoundEntry).find({
      where: { roundFormId: roundForm.id, judgingParticipantId: participantId }
    });
    for (const entry of entries) {
      entry.selected = false;
      entry.position = null;
    }
    if (entries.length > 0) {
      await manager.getRepository(JudgingRoundEntry).save(entries);
    }
  }
}

async function loadDistinctivesByPosition(manager: EntityManager): Promise<Map<number, AwardDistinctive>> {
  const rows = await manager.getRepository(AwardDistinctive).find({
    order: { position: "ASC" }
  });
  return new Map(rows.map((row) => [row.position, row]));
}

/** Ids de participantes que sobreviven a la ronda previa (FA o F1). */
async function getRosterForNextRound(
  manager: EntityManager,
  stage: FairCategoryStage
): Promise<string[]> {
  if (stage.status === "FA_CONSOLIDATED") {
    const survivors = await manager.getRepository(FaConsolidatedResult).find({
      where: { fairCategoryStageId: stage.id },
      order: { finalPosition: "ASC" }
    });
    return survivors.map((row) => row.judgingParticipantId);
  }

  if (stage.status === "F1_CONSOLIDATED") {
    const f1 = await getLatestRound(manager, stage.id, "F1");
    if (!f1) {
      throw new BadRequestError("No se encontró la ronda F1 consolidada.");
    }
    const results = await manager.getRepository(JudgingRoundResult).find({
      where: { roundId: f1.id },
      order: { finalPosition: "ASC" }
    });
    return results.map((row) => row.judgingParticipantId);
  }

  throw new BadRequestError("La categoría no está lista para abrir la siguiente ronda.");
}

async function seedRoundForms(
  manager: EntityManager,
  round: JudgingRound,
  fairId: string,
  participantIds: string[]
): Promise<void> {
  const judges = await getUsersByFairRole(manager, fairId, "2");
  if (judges.length === 0) {
    throw new BadRequestError("La feria no tiene jueces asignados.");
  }

  for (const judge of judges) {
    const form = await manager.getRepository(JudgingRoundForm).save(
      manager.getRepository(JudgingRoundForm).create({
        roundId: round.id,
        judgeUserId: judge.id,
        status: "PENDING",
        startedAt: null,
        closedAt: null
      })
    );

    await manager.getRepository(JudgingRoundEntry).save(
      participantIds.map((participantId) =>
        manager.getRepository(JudgingRoundEntry).create({
          roundFormId: form.id,
          judgingParticipantId: participantId,
          selected: false,
          position: null
        })
      )
    );
  }
}

// ─── Director Técnico: abrir ronda ──────────────────────────────────────────

export async function openNextRound(user: User, stageId: string): Promise<StagedCategoryDto> {
  assertUserRole(user, ["TECHNICAL_DIRECTOR"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["3"]);

    if (stage.status !== "FA_CONSOLIDATED" && stage.status !== "F1_CONSOLIDATED") {
      throw new BadRequestError("Solo se puede abrir una ronda desde FA o F1 consolidados.");
    }

    const roster = await getRosterForNextRound(manager, stage);
    if (roster.length === 0) {
      throw new BadRequestError("No hay ejemplares sobrevivientes para abrir la ronda.");
    }

    const roundType: JudgingRoundType =
      stage.status === "FA_CONSOLIDATED" && roster.length > F1_SURVIVOR_THRESHOLD ? "F1" : "F2";

    const round = await manager.getRepository(JudgingRound).save(
      manager.getRepository(JudgingRound).create({
        fairCategoryStageId: stage.id,
        roundType,
        sequence: 1,
        status: "OPEN",
        parentRoundId: null,
        openedAt: new Date(),
        openedByUserId: user.id,
        consolidatedAt: null,
        consolidatedByUserId: null,
        closedAt: null,
        closedByUserId: null
      })
    );

    await seedRoundForms(manager, round, stage.fairId, roster);

    const previousStatus = stage.status;
    stage.status = roundType === "F1" ? "F1_IN_PROGRESS" : "F2_IN_PROGRESS";
    await manager.getRepository(FairCategoryStage).save(stage);
    await recordEvent(manager, {
      stageId: stage.id,
      userId: user.id,
      eventType: "ROUND_OPENED",
      fromStatus: previousStatus,
      toStatus: stage.status,
      payload: { roundId: round.id, roundType, roster: roster.length }
    });

    const notification = stageNotificationContext(stage);
    const label = roundType === "F1" ? "F1 (cabeza de lote)" : "F2 (tarjeta final)";
    await queueRoleNotifications(manager, stage, "2", {
      type: "ROUND_OPENED",
      title: `${label} abierta - ${notification.titleSuffix}`,
      body: `El director técnico abrió ${label} para ${notification.detail}.`,
      payload: { ...notification.payload, roundId: round.id, roundType }
    });

    return buildStageSummary(manager, await getStageOrThrow(manager, stage.id));
  });
}

// ─── Juez: formulario de ronda ──────────────────────────────────────────────

async function getJudgeFormOrThrow(
  manager: EntityManager,
  roundId: string,
  judgeUserId: string
): Promise<JudgingRoundForm> {
  const form = await manager.getRepository(JudgingRoundForm).findOne({
    where: { roundId, judgeUserId }
  });

  if (!form) {
    throw new ForbiddenError("No tienes un formulario asignado en esta ronda.");
  }

  return form;
}

export async function startRoundForm(user: User, stageId: string) {
  assertUserRole(user, ["JUDGE"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["2"]);
    const round = await getActiveRoundOrThrow(manager, stage.id);
    const form = await getJudgeFormOrThrow(manager, round.id, user.id);

    if (form.status === "CLOSED") {
      throw new BadRequestError("El formulario ya está cerrado.");
    }

    if (form.status === "PENDING") {
      form.status = "STARTED";
      form.startedAt = new Date();
      await manager.getRepository(JudgingRoundForm).save(form);
      await recordEvent(manager, {
        stageId: stage.id,
        userId: user.id,
        eventType: "ROUND_FORM_STARTED",
        payload: { roundId: round.id }
      });
    } else if (form.status === "STARTED" && !form.startedAt) {
      form.startedAt = round.openedAt ?? new Date();
      await manager.getRepository(JudgingRoundForm).save(form);
    }

    return getRoundStateForJudge(manager, user, stage, round);
  });
}

export async function getRound(user: User, stageId: string) {
  assertUserRole(user, ["JUDGE"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["2"]);
    const round = await getLatestRound(manager, stage.id);
    if (!round) {
      throw new BadRequestError("Aún no hay rondas para esta categoría.");
    }
    return getRoundStateForJudge(manager, user, stage, round);
  });
}

export async function updateRoundForm(
  user: User,
  stageId: string,
  input: {
    selectedParticipantIds?: string[];
    positions?: Array<{ participantId: string; position: number }>;
    desertedPositions?: number[];
  }
) {
  assertUserRole(user, ["JUDGE"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["2"]);
    const round = await getActiveRoundOrThrow(manager, stage.id);
    const form = await getJudgeFormOrThrow(manager, round.id, user.id);

    if (form.status !== "STARTED") {
      throw new BadRequestError("Solo puedes editar un formulario iniciado.");
    }

    const entries = await manager.getRepository(JudgingRoundEntry).find({
      where: { roundFormId: form.id }
    });
    const entryByParticipant = new Map(entries.map((entry) => [entry.judgingParticipantId, entry]));
    const statusByParticipant = await loadParticipantStatusMap(
      manager,
      entries.map((entry) => entry.judgingParticipantId)
    );
    const isEligible = (participantId: string) => statusByParticipant.get(participantId) === "ELIGIBLE";

    if (round.roundType === "F1") {
      const selected = Array.from(new Set(input.selectedParticipantIds ?? []));
      if (selected.length > MAX_F1_SELECTIONS) {
        throw new BadRequestError(`En F1 solo puedes seleccionar máximo ${MAX_F1_SELECTIONS} ejemplares.`);
      }
      if (selected.some((id) => !entryByParticipant.has(id))) {
        throw new BadRequestError("La selección contiene ejemplares fuera de la ronda.");
      }
      if (selected.some((id) => !isEligible(id))) {
        throw new BadRequestError("No puedes seleccionar ejemplares descalificados.");
      }
      for (const entry of entries) {
        if (!isEligible(entry.judgingParticipantId)) {
          entry.selected = false;
          entry.position = null;
          continue;
        }
        entry.selected = selected.includes(entry.judgingParticipantId);
        entry.position = null;
      }
      await manager.getRepository(JudgingRoundFormDesertedPosition).delete({ roundFormId: form.id });
    } else {
      // F2 / desempate: puestos ordinales únicos.
      const positions = input.positions ?? [];
      const desertedPositions = Array.from(new Set(input.desertedPositions ?? []));
      const eligibleEntries = entries.filter((entry) => isEligible(entry.judgingParticipantId));
      const eligibleCount = eligibleEntries.length;
      const maxDesertablePosition = Math.min(eligibleCount, MAX_AWARD_POSITIONS);
      const maxAssignablePosition = eligibleCount + desertedPositions.length;
      const positionByParticipant = new Map(positions.map((p) => [p.participantId, p.position]));
      for (const { participantId, position } of positions) {
        if (!entryByParticipant.has(participantId)) {
          throw new BadRequestError("Los puestos contienen ejemplares fuera de la ronda.");
        }
        if (!isEligible(participantId)) {
          throw new BadRequestError("No puedes asignar puesto a un ejemplar descalificado.");
        }
        if (!Number.isInteger(position) || position < 1 || position > maxAssignablePosition) {
          throw new BadRequestError("Los puestos deben ser números válidos.");
        }
      }
      const assigned = positions.map((p) => p.position);
      if (new Set(assigned).size !== assigned.length) {
        throw new BadRequestError("No puedes repetir un mismo puesto.");
      }
      for (const position of desertedPositions) {
        if (
          !Number.isInteger(position) ||
          position < MIN_AWARD_POSITION ||
          position > maxDesertablePosition
        ) {
          throw new BadRequestError(`Los puestos desiertos válidos están entre 1 y ${maxDesertablePosition}.`);
        }
      }
      const overlap = desertedPositions.some((position) => assigned.includes(position));
      if (overlap) {
        throw new BadRequestError("Un mismo puesto no puede estar asignado y desierto al mismo tiempo.");
      }
      for (const entry of entries) {
        if (!isEligible(entry.judgingParticipantId)) {
          entry.position = null;
          entry.selected = false;
          continue;
        }
        entry.position = positionByParticipant.get(entry.judgingParticipantId) ?? null;
        entry.selected = false;
      }
      await manager.getRepository(JudgingRoundFormDesertedPosition).delete({ roundFormId: form.id });
      if (desertedPositions.length > 0) {
        await manager.getRepository(JudgingRoundFormDesertedPosition).save(
          desertedPositions.map((position) =>
            manager.getRepository(JudgingRoundFormDesertedPosition).create({
              roundFormId: form.id,
              position
            })
          )
        );
      }
    }

    await manager.getRepository(JudgingRoundEntry).save(entries);
    return getRoundStateForJudge(manager, user, stage, round);
  });
}

export async function disqualifyRoundParticipant(
  user: User,
  stageId: string,
  judgingParticipantId: string,
  reasonId: string
) {
  assertUserRole(user, ["JUDGE"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["2"]);

    const roundPhaseStatuses = ["F1_IN_PROGRESS", "F2_IN_PROGRESS", "TIE_BREAK_IN_PROGRESS"] as const;
    if (!roundPhaseStatuses.includes(stage.status as (typeof roundPhaseStatuses)[number])) {
      throw new BadRequestError("Solo puedes descalificar durante una ronda activa.");
    }

    const round = await getActiveRoundOrThrow(manager, stage.id);
    const form = await getJudgeFormOrThrow(manager, round.id, user.id);

    if (form.status !== "STARTED") {
      throw new BadRequestError("Solo puedes descalificar con la tarjeta iniciada.");
    }

    const [participant, reason, entry] = await Promise.all([
      manager.getRepository(JudgingParticipant).findOne({
        where: { id: judgingParticipantId, fairCategoryStageId: stage.id },
        relations: { fairEntry: true }
      }),
      manager.getRepository(DisqualificationReason).findOne({
        where: { id: reasonId, isActive: true }
      }),
      manager.getRepository(JudgingRoundEntry).findOne({
        where: { roundFormId: form.id, judgingParticipantId }
      })
    ]);

    if (!participant) {
      throw new NotFoundError("No se encontró el participante de juzgamiento.");
    }

    if (!reason) {
      throw new NotFoundError("No se encontró el motivo de descalificación.");
    }

    if (!entry) {
      throw new BadRequestError("El ejemplar no pertenece a la ronda activa.");
    }

    if (participant.status === "DISQUALIFIED") {
      throw new BadRequestError("El ejemplar ya está descalificado.");
    }

    participant.status = "DISQUALIFIED";
    participant.disqualificationReasonId = reason.id;
    participant.disqualifiedAt = new Date();
    participant.disqualifiedByUserId = user.id;
    participant.disqualifiedInRoundId = round.id;
    participant.disqualifiedInRoundFormId = form.id;
    await manager.getRepository(JudgingParticipant).save(participant);
    await clearParticipantRoundAssignments(manager, round.id, participant.id);

    await recordEvent(manager, {
      stageId: stage.id,
      userId: user.id,
      eventType: "JUDGING_PARTICIPANT_DISQUALIFIED",
      payload: {
        judgingParticipantId: participant.id,
        reasonId: reason.id,
        roundId: round.id,
        roundType: round.roundType
      }
    });

    const notification = stageNotificationContext(stage);
    await queueRoleNotifications(manager, stage, "2", {
      type: "JUDGING_PARTICIPANT_DISQUALIFIED",
      title: `Ejemplar ${participant.fairEntry?.trackPosition ?? ""} descalificado - ${notification.titleSuffix}`.trim(),
      body: `Motivo: ${reason.name}. Categoría: ${notification.detail}.`,
      payload: {
        ...notification.payload,
        judgingParticipantId: participant.id,
        reasonId: reason.id,
        roundId: round.id
      }
    });
    await queueRoleNotifications(manager, stage, "3", {
      type: "JUDGING_PARTICIPANT_DISQUALIFIED",
      title: `Ejemplar ${participant.fairEntry?.trackPosition ?? ""} descalificado - ${notification.titleSuffix}`.trim(),
      body: `Motivo: ${reason.name}. Categoría: ${notification.detail}.`,
      payload: {
        ...notification.payload,
        judgingParticipantId: participant.id,
        reasonId: reason.id,
        roundId: round.id
      }
    });

    return getRoundStateForJudge(manager, user, stage, round);
  });
}

export async function closeRoundForm(user: User, stageId: string) {
  assertUserRole(user, ["JUDGE"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["2"]);
    const round = await getActiveRoundOrThrow(manager, stage.id);
    const form = await getJudgeFormOrThrow(manager, round.id, user.id);

    if (form.status !== "STARTED") {
      throw new BadRequestError("Solo puedes cerrar un formulario iniciado.");
    }

    const entries = await manager.getRepository(JudgingRoundEntry).find({
      where: { roundFormId: form.id }
    });
    const statusByParticipant = await loadParticipantStatusMap(
      manager,
      entries.map((entry) => entry.judgingParticipantId)
    );
    const isEligible = (participantId: string) => statusByParticipant.get(participantId) === "ELIGIBLE";

    if (round.roundType === "F1") {
      const selectedCount = entries.filter(
        (entry) => entry.selected && isEligible(entry.judgingParticipantId)
      ).length;
      if (selectedCount > MAX_F1_SELECTIONS) {
        throw new BadRequestError(`F1 permite máximo ${MAX_F1_SELECTIONS} seleccionados.`);
      }
    } else {
      const eligibleEntries = entries.filter((entry) => isEligible(entry.judgingParticipantId));
      const eligibleCount = eligibleEntries.length;
      const desertedRows = await manager
        .getRepository(JudgingRoundFormDesertedPosition)
        .find({ where: { roundFormId: form.id } });
      const maxDesertablePosition = Math.min(eligibleCount, MAX_AWARD_POSITIONS);
      const deserted = new Set(desertedRows.map((row) => row.position));
      for (const position of deserted) {
        if (position < MIN_AWARD_POSITION || position > maxDesertablePosition) {
          throw new BadRequestError(
            `Solo puedes declarar desiertos los puestos premiables entre 1 y ${maxDesertablePosition}.`
          );
        }
      }
      const positioned = eligibleEntries.filter((entry) => entry.position !== null);
      const assigned = positioned.map((entry) => entry.position as number);
      const maxAssignablePosition = eligibleCount + deserted.size;
      if (positioned.length !== eligibleCount) {
        throw new BadRequestError("Debes asignar un puesto a cada ejemplar elegible antes de cerrar.");
      }
      if (assigned.some((position) => position < 1 || position > maxAssignablePosition)) {
        throw new BadRequestError("Los puestos asignados no corresponden al número de ejemplares y desiertos.");
      }
      if (new Set(assigned).size !== assigned.length) {
        throw new BadRequestError("No puedes repetir un mismo puesto.");
      }
      const hasOverlap = assigned.some((position) => deserted.has(position));
      if (hasOverlap) {
        throw new BadRequestError("No puedes cerrar con un puesto simultáneamente asignado y desierto.");
      }
      for (let position = 1; position <= maxAssignablePosition; position += 1) {
        if (!deserted.has(position) && !assigned.includes(position)) {
          throw new BadRequestError("Debes cubrir todos los puestos con ejemplar o desierto antes de cerrar.");
        }
      }
    }

    if (!form.startedAt) {
      form.startedAt = round.openedAt ?? new Date();
    }
    form.status = "CLOSED";
    form.closedAt = new Date();
    await manager.getRepository(JudgingRoundForm).save(form);
    await recordEvent(manager, {
      stageId: stage.id,
      userId: user.id,
      eventType: "ROUND_FORM_CLOSED",
      payload: { roundId: round.id }
    });
    const notification = stageNotificationContext(stage);
    await queueRoleNotifications(manager, stage, "3", {
      type: "ROUND_FORM_CLOSED",
      title: `Tarjeta ${round.roundType} cerrada - ${notification.titleSuffix}`,
      body: `Un juez cerró su tarjeta ${round.roundType} para ${notification.detail}.`,
      payload: { ...notification.payload, roundId: round.id, judgeUserId: user.id }
    });

    return getRoundStateForJudge(manager, user, stage, round);
  });
}

// ─── Director Técnico: consolidar ronda ─────────────────────────────────────

async function assertAllFormsClosed(manager: EntityManager, round: JudgingRound, fairId: string): Promise<void> {
  const judges = await getUsersByFairRole(manager, fairId, "2");
  const forms = await manager.getRepository(JudgingRoundForm).find({ where: { roundId: round.id } });
  const closed = new Set(forms.filter((form) => form.status === "CLOSED").map((form) => form.judgeUserId));
  if (judges.length === 0 || judges.some((judge) => !closed.has(judge.id))) {
    throw new BadRequestError("Todos los jueces deben cerrar su tarjeta antes de consolidar.");
  }
}

export async function consolidateRound(user: User, stageId: string): Promise<StagedCategoryDto> {
  assertUserRole(user, ["TECHNICAL_DIRECTOR"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["3"]);
    const round = await getActiveRoundOrThrow(manager, stage.id);
    await assertAllFormsClosed(manager, round, stage.fairId);
    const previousStatus = stage.status;

    if (round.roundType === "F1") {
      const survivors = await consolidateF1(manager, round);
      if (survivors === 0) {
        stage.status = "JUDGING_DESERTED";
        stage.desertedAt = new Date();
        stage.desertedByUserId = user.id;
        stage.desertedReason = "La ronda F1 consolidó sin ejemplares seleccionados.";
      } else {
        stage.status = "F1_CONSOLIDATED";
      }
    } else if (round.roundType === "F2") {
      await consolidateRankingRound(manager, round, stage.fairId);
      stage.status = "F2_IN_PROGRESS";
    } else {
      await consolidateTieBreak(manager, round, stage.fairId);
      stage.status = "F2_IN_PROGRESS";
    }

    round.status = "CONSOLIDATED";
    round.consolidatedAt = new Date();
    round.consolidatedByUserId = user.id;
    await manager.getRepository(JudgingRound).save(round);
    await manager.getRepository(FairCategoryStage).save(stage);
    await recordEvent(manager, {
      stageId: stage.id,
      userId: user.id,
      eventType: stage.status === "JUDGING_DESERTED" ? "COMPETITION_DESERTED" : "ROUND_CONSOLIDATED",
      fromStatus: previousStatus,
      toStatus: stage.status,
      payload:
        stage.status === "JUDGING_DESERTED"
          ? { roundId: round.id, roundType: round.roundType, reason: stage.desertedReason }
          : { roundId: round.id, roundType: round.roundType }
    });

    return buildStageSummary(manager, await getStageOrThrow(manager, stage.id));
  });
}

async function consolidateF1(manager: EntityManager, round: JudgingRound): Promise<number> {
  const entries = await manager
    .getRepository(JudgingRoundEntry)
    .createQueryBuilder("entry")
    .innerJoin("entry.roundForm", "form")
    .innerJoin("entry.judgingParticipant", "participant")
    .where("form.round_id = :roundId", { roundId: round.id })
    .andWhere("entry.selected = true")
    .andWhere("participant.status = :participantStatus", { participantStatus: "ELIGIBLE" })
    .select("entry.judging_participant_id", "participantId")
    .addSelect("COUNT(entry.id)", "votes")
    .groupBy("entry.judging_participant_id")
    .orderBy("COUNT(entry.id)", "DESC")
    .getRawMany<{ participantId: string; votes: string }>();

  await manager.getRepository(JudgingRoundResult).delete({ roundId: round.id });
  await manager.getRepository(JudgingRoundResult).save(
    entries.map((row, index) =>
      manager.getRepository(JudgingRoundResult).create({
        roundId: round.id,
        judgingParticipantId: row.participantId,
        scoreValue: Number(row.votes),
        firstPlaceVotes: 0,
        finalPosition: index + 1,
        status: "FINAL" as JudgingRoundResultStatus
      })
    )
  );
  return entries.length;
}

async function loadJudgeCards(manager: EntityManager, roundId: string): Promise<JudgeCard[]> {
  const forms = await manager.getRepository(JudgingRoundForm).find({ where: { roundId } });
  const cards: JudgeCard[] = [];
  for (const form of forms) {
    const [entries, desertedRows] = await Promise.all([
      manager.getRepository(JudgingRoundEntry).find({ where: { roundFormId: form.id } }),
      manager.getRepository(JudgingRoundFormDesertedPosition).find({ where: { roundFormId: form.id } })
    ]);
    const statusByParticipant = await loadParticipantStatusMap(
      manager,
      entries.map((entry) => entry.judgingParticipantId)
    );
    cards.push({
      judgeUserId: form.judgeUserId,
      positions: entries
        .filter(
          (entry) =>
            entry.position !== null && statusByParticipant.get(entry.judgingParticipantId) === "ELIGIBLE"
        )
        .map((entry) => ({ participantId: entry.judgingParticipantId, position: entry.position as number })),
      desertedPositions: desertedRows.map((row) => row.position)
    });
  }
  return cards;
}

async function consolidateRankingRound(
  manager: EntityManager,
  round: JudgingRound,
  fairId: string
): Promise<void> {
  const judges = await getUsersByFairRole(manager, fairId, "2");
  const cards = await loadJudgeCards(manager, round.id);
  const scoring = computeF2(cards, judges.length);

  await manager.getRepository(JudgingRoundResult).delete({ roundId: round.id });
  await manager.getRepository(JudgingRoundDesertedResult).delete({ roundId: round.id });
  if (scoring.participants.length > 0) {
    await manager.getRepository(JudgingRoundResult).save(
      scoring.participants.map((participant) =>
        manager.getRepository(JudgingRoundResult).create({
          roundId: round.id,
          judgingParticipantId: participant.participantId,
          scoreValue: participant.positionSum,
          firstPlaceVotes: participant.firstPlaceVotes,
          finalPosition: participant.finalPosition,
          status: (participant.tied ? "TIED" : "PROVISIONAL") as JudgingRoundResultStatus
        })
      )
    );
  }
  if (scoring.desertedResults.length > 0) {
    await manager.getRepository(JudgingRoundDesertedResult).save(
      scoring.desertedResults.map((row) =>
        manager.getRepository(JudgingRoundDesertedResult).create({
          roundId: round.id,
          finalPosition: row.finalPosition,
          votesCount: row.votesCount
        })
      )
    );
  }

  if (scoring.hasTie) {
    const stage = await getStageOrThrow(manager, round.fairCategoryStageId);
    await recordEvent(manager, {
      stageId: round.fairCategoryStageId,
      userId: null,
      eventType: "TIE_DETECTED",
      payload: { roundId: round.id, tiedGroups: scoring.tiedGroups }
    });
    const notification = stageNotificationContext(stage);
    await queueRoleNotifications(manager, stage, "3", {
      type: "TIE_DETECTED",
      title: `Empate detectado - ${notification.titleSuffix}`,
      body: `El cómputo F2 de ${notification.detail} tiene empate. Abre una ronda de desempate.`,
      payload: { ...notification.payload, roundId: round.id }
    });
  }
}

async function consolidateTieBreak(
  manager: EntityManager,
  round: JudgingRound,
  fairId: string
): Promise<void> {
  if (!round.parentRoundId) {
    throw new BadRequestError("La ronda de desempate no tiene una ronda F2 asociada.");
  }
  const judges = await getUsersByFairRole(manager, fairId, "2");
  const cards = await loadJudgeCards(manager, round.id);
  const scoring = computeF2(cards, judges.length);

  // Resultados propios de la ronda de desempate (trazabilidad).
  await manager.getRepository(JudgingRoundResult).delete({ roundId: round.id });
  await manager.getRepository(JudgingRoundDesertedResult).delete({ roundId: round.id });
  if (scoring.participants.length > 0) {
    await manager.getRepository(JudgingRoundResult).save(
      scoring.participants.map((participant) =>
        manager.getRepository(JudgingRoundResult).create({
          roundId: round.id,
          judgingParticipantId: participant.participantId,
          scoreValue: participant.positionSum,
          firstPlaceVotes: participant.firstPlaceVotes,
          finalPosition: participant.finalPosition,
          status: (participant.tied ? "TIED" : "PROVISIONAL") as JudgingRoundResultStatus
        })
      )
    );
  }
  if (scoring.desertedResults.length > 0) {
    await manager.getRepository(JudgingRoundDesertedResult).save(
      scoring.desertedResults.map((row) =>
        manager.getRepository(JudgingRoundDesertedResult).create({
          roundId: round.id,
          finalPosition: row.finalPosition,
          votesCount: row.votesCount
        })
      )
    );
  }

  // Mezcla el orden del desempate dentro del bloque empatado de la ronda F2 padre.
  const parentResults = await manager.getRepository(JudgingRoundResult).find({
    where: { roundId: round.parentRoundId },
    order: { finalPosition: "ASC" }
  });
  const tiedBlock = parentResults.filter((row) => row.status === "TIED");
  if (tiedBlock.length === 0) return;
  const blockStart = Math.min(...tiedBlock.map((row) => row.finalPosition ?? 0));
  const orderById = new Map(scoring.participants.map((p) => [p.participantId, p]));

  const reordered = [...tiedBlock].sort((a, b) => {
    const pa = orderById.get(a.judgingParticipantId)?.finalPosition ?? Number.MAX_SAFE_INTEGER;
    const pb = orderById.get(b.judgingParticipantId)?.finalPosition ?? Number.MAX_SAFE_INTEGER;
    return pa - pb;
  });

  let unresolvedByMajority = false;
  reordered.forEach((row, index) => {
    const scored = orderById.get(row.judgingParticipantId);
    if (!scored) {
      unresolvedByMajority = true;
      row.status = "TIED";
      return;
    }
    row.finalPosition = blockStart + index;
    row.status = (scored.tied ? "TIED" : "PROVISIONAL") as JudgingRoundResultStatus;
  });
  await manager.getRepository(JudgingRoundResult).save(reordered);

  if (scoring.hasTie || unresolvedByMajority) {
    const stage = await getStageOrThrow(manager, round.fairCategoryStageId);
    const notification = stageNotificationContext(stage);
    await queueRoleNotifications(manager, stage, "3", {
      type: "TIE_DETECTED",
      title: `Empate persiste - ${notification.titleSuffix}`,
      body: `El desempate de ${notification.detail} sigue empatado. Abre otra ronda de desempate.`,
      payload: { ...notification.payload, roundId: round.id }
    });
  }
}

// ─── Director Técnico: abrir desempate ──────────────────────────────────────

export async function openTieBreak(
  user: User,
  stageId: string,
  input: { testTypes: TieBreakTestType[] }
): Promise<StagedCategoryDto> {
  assertUserRole(user, ["TECHNICAL_DIRECTOR"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["3"]);

    const f2 = await getLatestRound(manager, stage.id, "F2");
    if (!f2 || f2.status !== "CONSOLIDATED") {
      throw new BadRequestError("Necesitas una ronda F2 consolidada para abrir un desempate.");
    }

    const tiedResults = await manager.getRepository(JudgingRoundResult).find({
      where: { roundId: f2.id, status: "TIED" }
    });
    if (tiedResults.length < 2) {
      throw new BadRequestError("No hay un empate pendiente para resolver.");
    }

    const existingTieBreaks = await manager.getRepository(JudgingRound).count({
      where: { fairCategoryStageId: stage.id, roundType: "TIE_BREAK" }
    });

    const round = await manager.getRepository(JudgingRound).save(
      manager.getRepository(JudgingRound).create({
        fairCategoryStageId: stage.id,
        roundType: "TIE_BREAK",
        sequence: existingTieBreaks + 1,
        status: "OPEN",
        parentRoundId: f2.id,
        openedAt: new Date(),
        openedByUserId: user.id,
        consolidatedAt: null,
        consolidatedByUserId: null,
        closedAt: null,
        closedByUserId: null
      })
    );

    const testTypes = Array.from(new Set(input.testTypes));
    if (testTypes.length > 0) {
      await manager.getRepository(TieBreakTest).save(
        testTypes.map((testType, index) =>
          manager.getRepository(TieBreakTest).create({
            roundId: round.id,
            testType,
            testOrder: index + 1,
            status: "PENDING"
          })
        )
      );
    }

    await seedRoundForms(
      manager,
      round,
      stage.fairId,
      tiedResults.map((row) => row.judgingParticipantId)
    );

    const previousStatus = stage.status;
    stage.status = "TIE_BREAK_IN_PROGRESS";
    await manager.getRepository(FairCategoryStage).save(stage);
    await recordEvent(manager, {
      stageId: stage.id,
      userId: user.id,
      eventType: "TIE_BREAK_OPENED",
      fromStatus: previousStatus,
      toStatus: stage.status,
      payload: { roundId: round.id, parentRoundId: f2.id, testTypes }
    });
    const notification = stageNotificationContext(stage);
    await queueRoleNotifications(manager, stage, "2", {
      type: "TIE_BREAK_OPENED",
      title: `Desempate abierto - ${notification.titleSuffix}`,
      body: `El director técnico abrió un desempate para ${notification.detail}.`,
      payload: { ...notification.payload, roundId: round.id }
    });

    return buildStageSummary(manager, await getStageOrThrow(manager, stage.id));
  });
}

// ─── Director Técnico: cerrar resultado oficial ─────────────────────────────

export async function closeResults(user: User, stageId: string): Promise<StagedCategoryDto> {
  assertUserRole(user, ["TECHNICAL_DIRECTOR"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["3"]);

    const f2 = await getLatestRound(manager, stage.id, "F2");
    if (!f2 || f2.status === "OPEN") {
      throw new BadRequestError("Debes consolidar la ronda F2 antes de cerrar el resultado.");
    }

    const activeTieBreak = await manager.getRepository(JudgingRound).findOne({
      where: { fairCategoryStageId: stage.id, roundType: "TIE_BREAK", status: "OPEN" }
    });
    if (activeTieBreak) {
      throw new BadRequestError("Hay un desempate en curso. Consolídalo antes de cerrar.");
    }

    const results = await manager.getRepository(JudgingRoundResult).find({ where: { roundId: f2.id } });
    if (results.length === 0) {
      throw new BadRequestError("No hay ejemplares premiables. Declara la competencia como desierta.");
    }
    if (results.some((row) => row.status === "TIED")) {
      throw new BadRequestError("Hay un empate sin resolver. Abre un desempate antes de cerrar.");
    }

    for (const row of results) {
      row.status = "FINAL";
    }
    await manager.getRepository(JudgingRoundResult).save(results);

    f2.status = "CLOSED";
    f2.closedAt = new Date();
    f2.closedByUserId = user.id;
    await manager.getRepository(JudgingRound).save(f2);

    const previousStatus = stage.status;
    stage.status = "JUDGING_CLOSED";
    stage.judgingClosedAt = new Date();
    stage.judgingClosedByUserId = user.id;
    stage.desertedAt = null;
    stage.desertedByUserId = null;
    stage.desertedReason = null;
    await manager.getRepository(FairCategoryStage).save(stage);
    await recordEvent(manager, {
      stageId: stage.id,
      userId: user.id,
      eventType: "JUDGING_CLOSED",
      fromStatus: previousStatus,
      toStatus: stage.status,
      payload: { roundId: f2.id }
    });
    const notification = stageNotificationContext(stage);
    await queueRoleNotifications(manager, stage, "2", {
      type: "JUDGING_CLOSED",
      title: `Resultado oficial - ${notification.titleSuffix}`,
      body: `El resultado oficial de ${notification.detail} quedó cerrado.`,
      payload: notification.payload
    });

    return buildStageSummary(manager, await getStageOrThrow(manager, stage.id));
  });
}

export async function desertCompetition(
  user: User,
  stageId: string,
  input?: { reason?: string | null }
): Promise<StagedCategoryDto> {
  assertUserRole(user, ["TECHNICAL_DIRECTOR"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["3"]);
    const previousStatus = stage.status;

    if (previousStatus === "JUDGING_CLOSED" || previousStatus === "JUDGING_DESERTED") {
      throw new BadRequestError("La categoría ya fue cerrada.");
    }

    stage.status = "JUDGING_DESERTED";
    stage.desertedAt = new Date();
    stage.desertedByUserId = user.id;
    stage.desertedReason = input?.reason?.trim() || "Sin ejemplares premiables según criterio de juzgamiento.";
    await manager.getRepository(FairCategoryStage).save(stage);

    await recordEvent(manager, {
      stageId: stage.id,
      userId: user.id,
      eventType: "COMPETITION_DESERTED",
      fromStatus: previousStatus,
      toStatus: stage.status,
      payload: { reason: stage.desertedReason }
    });

    const notification = stageNotificationContext(stage);
    await queueRoleNotifications(manager, stage, "2", {
      type: "COMPETITION_DESERTED",
      title: `Competencia desierta - ${notification.titleSuffix}`,
      body: `El Director Técnico declaró desierta la categoría ${notification.detail}.`,
      payload: { ...notification.payload, reason: stage.desertedReason }
    });

    return buildStageSummary(manager, await getStageOrThrow(manager, stage.id));
  });
}

// ─── DTOs de lectura ────────────────────────────────────────────────────────

type RoundParticipantDto = {
  id: string;
  trackPosition: number;
  riderName: string;
  registrationNumber: string;
  status: JudgingParticipantStatus;
  disqualificationReason: {
    id: string;
    code: string;
    name: string;
    description: string | null;
  } | null;
  selected: boolean;
  position: number | null;
  privateNote: string | null;
  reminders: EntryReminderDto[];
};

async function getRoundStateForJudge(
  manager: EntityManager,
  user: User,
  stage: FairCategoryStage,
  round: JudgingRound
) {
  const form = await manager.getRepository(JudgingRoundForm).findOne({
    where: { roundId: round.id, judgeUserId: user.id }
  });
  const entries = form
    ? await manager.getRepository(JudgingRoundEntry).find({ where: { roundFormId: form.id } })
    : [];
  const remindersByEntryId =
    round.roundType === "F1" && entries.length > 0
      ? await loadRemindersByEntryIds(
          manager,
          entries.map((entry) => entry.id)
        )
      : new Map<string, EntryReminderDto[]>();

  const participants = await loadParticipants(
    manager,
    entries.map((entry) => entry.judgingParticipantId)
  );
  const participantById = new Map(participants.map((p) => [p.id, p]));

  const roster: RoundParticipantDto[] = entries
    .map((entry) => {
      const participant = participantById.get(entry.judgingParticipantId);
      return {
        id: entry.judgingParticipantId,
        trackPosition: participant?.fairEntry.trackPosition ?? 0,
        riderName: participant?.fairEntry.riderName ?? "",
        registrationNumber: participant?.fairEntry.registrationNumber ?? "",
        status: participant?.status ?? "ELIGIBLE",
        disqualificationReason: participant?.disqualificationReason
          ? {
              id: participant.disqualificationReason.id,
              code: participant.disqualificationReason.code,
              name: participant.disqualificationReason.name,
              description: participant.disqualificationReason.description
            }
          : null,
        selected: entry.selected,
        position: entry.position,
        privateNote: round.roundType === "F1" ? entry.privateNote : null,
        reminders: remindersByEntryId.get(entry.id) ?? []
      };
    })
    .sort((a, b) => a.trackPosition - b.trackPosition);

  const availableReminders =
    round.roundType === "F1" ? await loadActiveReminders(manager) : [];
  const reminderHistory: ReminderHistoryItemDto[] =
    round.roundType === "F1" && form
      ? await loadReminderHistory(manager, form.id)
      : [];
  const disqualificationReasons = await loadActiveDisqualificationReasons(manager);

  return {
    stage: await buildStageSummary(manager, stage),
    round: {
      id: round.id,
      roundType: round.roundType,
      sequence: round.sequence,
      status: round.status
    },
    form: form
      ? {
          id: form.id,
          status: form.status,
          closedAt: form.closedAt?.toISOString() ?? null,
          desertedPositions: (
            await manager.getRepository(JudgingRoundFormDesertedPosition).find({
              where: { roundFormId: form.id },
              order: { position: "ASC" }
            })
          ).map((row) => row.position)
        }
      : null,
    maxSelections: round.roundType === "F1" ? MAX_F1_SELECTIONS : null,
    availableReminders,
    reminderHistory,
    disqualificationReasons,
    participants: roster
  };
}

// ─── DTO de gestión (Director Técnico) ──────────────────────────────────────

export async function getRoundsManagement(user: User, stageId: string) {
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage);

    const rounds = await manager.getRepository(JudgingRound).find({
      where: { fairCategoryStageId: stage.id },
      order: { createdAt: "ASC" }
    });
    const distinctivesByPosition = await loadDistinctivesByPosition(manager);

    const roundDtos = [];
    for (const round of rounds) {
      const forms = await manager.getRepository(JudgingRoundForm).find({
        where: { roundId: round.id },
        relations: { judgeUser: { person: true } }
      });
      const entries = forms.length
        ? await manager.getRepository(JudgingRoundEntry).find({
            where: forms.map((form) => ({ roundFormId: form.id })),
            relations: { judgingParticipant: { fairEntry: true } }
          })
        : [];
      const formDesertedRows = forms.length
        ? await manager.getRepository(JudgingRoundFormDesertedPosition).find({
            where: forms.map((form) => ({ roundFormId: form.id })),
            order: { position: "ASC" }
          })
        : [];
      const results = await manager.getRepository(JudgingRoundResult).find({
        where: { roundId: round.id },
        relations: { judgingParticipant: { fairEntry: true } },
        order: { finalPosition: "ASC" }
      });
      const desertedResults = await manager.getRepository(JudgingRoundDesertedResult).find({
        where: { roundId: round.id },
        order: { finalPosition: "ASC" }
      });
      const tests = await manager.getRepository(TieBreakTest).find({
        where: { roundId: round.id },
        order: { testOrder: "ASC" }
      });

      roundDtos.push({
        id: round.id,
        roundType: round.roundType,
        sequence: round.sequence,
        status: round.status,
        openedAt: round.openedAt?.toISOString() ?? null,
        forms: forms.map((form) => ({
          id: form.id,
          judgeName: form.judgeUser.person
            ? `${form.judgeUser.person.name} ${form.judgeUser.person.lastName}`.trim()
            : ROLE_LABELS.JUDGE,
          status: form.status,
          startedAt: form.startedAt?.toISOString() ?? null,
          closedAt: form.closedAt?.toISOString() ?? null,
          desertedPositions: formDesertedRows
            .filter((row) => row.roundFormId === form.id)
            .map((row) => row.position),
          entries: entries
            .filter((entry) => entry.roundFormId === form.id)
            .map((entry) => ({
              participantId: entry.judgingParticipantId,
              trackPosition: entry.judgingParticipant.fairEntry.trackPosition,
              riderName: entry.judgingParticipant.fairEntry.riderName,
              registrationNumber: entry.judgingParticipant.fairEntry.registrationNumber,
              selected: entry.selected,
              position: entry.position
            }))
            .sort((a, b) => {
              // F2/desempate: orden por puesto. F1: orden por número de ejemplar.
              if (a.position !== null && b.position !== null) return a.position - b.position;
              if (a.position !== null) return -1;
              if (b.position !== null) return 1;
              return a.trackPosition - b.trackPosition;
            })
        })),
        results: results.map((row) => ({
          id: row.id,
          trackPosition: row.judgingParticipant.fairEntry.trackPosition,
          riderName: row.judgingParticipant.fairEntry.riderName,
          registrationNumber: row.judgingParticipant.fairEntry.registrationNumber,
          scoreValue: row.scoreValue,
          firstPlaceVotes: row.firstPlaceVotes,
          finalPosition: row.finalPosition,
          status: row.status,
          awardDistinctive:
            round.roundType === "F1"
              ? null
              : resolveAwardDistinctiveForPosition(distinctivesByPosition, row.finalPosition)
        })),
        desertedResults: desertedResults.map((row) => ({
          id: row.id,
          finalPosition: row.finalPosition,
          votesCount: row.votesCount,
          awardDistinctive:
            round.roundType === "F1"
              ? null
              : resolveAwardDistinctiveForPosition(distinctivesByPosition, row.finalPosition)
        })),
        tests: tests.map((test) => ({
          id: test.id,
          testType: test.testType,
          label: TIE_BREAK_TEST_LABELS[test.testType],
          testOrder: test.testOrder,
          status: test.status
        }))
      });
    }

    return {
      stage: await buildStageSummary(manager, stage),
      rounds: roundDtos
    };
  });
}
