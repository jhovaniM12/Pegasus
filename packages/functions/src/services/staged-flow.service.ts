import {
  DisqualificationReason,
  FaConsolidatedResult,
  FaJudgeEntryDecision,
  FaJudgeForm,
  FaRepeatTrackRequest,
  FairCategoryStage,
  FairEntry,
  FairStaff,
  getDataSource,
  JudgingParticipant,
  JudgingRound,
  JudgingRoundEntry,
  JudgingRoundForm,
  NotificationOutbox,
  Role,
  User,
  type FairCategoryStageStatus,
  type UserRole,
  type JudgingRoundFormStatus,
  type JudgingRoundType,
  type VeterinaryCheckStatus,
  VeterinaryCheck,
  WorkflowEvent
} from "@pegasus/core";
import type { DataSource, EntityManager } from "typeorm";
import { Brackets, In } from "typeorm";
import { BadRequestError, ForbiddenError, FormClosedError, NotFoundError, StageAdvancedError } from "../lib/errors.js";
import {
  assertExpectedRevision,
  executeIdempotentMutation
} from "./offline-idempotency.service.js";
import type { MutationSyncMeta } from "../lib/http.js";
import {
  ROLE_LABELS,
  assertStageAccess,
  assertUserRole,
  formatStaffDisplayName,
  getStageOrThrow,
  getUsersByFairRole,
  queueRoleNotifications,
  recordEvent,
  roleExternalIdForUser,
  stageNotificationContext,
  toDisqualifiedByDto
} from "./judging/shared.js";
import { filterIndividualJudgingCategories } from "./judging/category-flow-rules.js";

export type JudgeFormatKey = "FA" | "F1" | "F2" | "TIE_BREAK";
export type JudgeFormatStatus = "NOT_AVAILABLE" | "PENDING" | "STARTED" | "CLOSED";

export type JudgeFormatDto = {
  key: JudgeFormatKey;
  formStatus: JudgeFormatStatus;
  isActive: boolean;
  participantCount: number | null;
};

export type StagedCategoryDto = {
  stageId: string;
  revision: number;
  status: FairCategoryStageStatus;
  fair: { id: string; name: string | null };
  category: { id: string; name: string | null; minAgeMonths: number; maxAgeMonths: number };
  gait: { id: string; name: string | null };
  totalEntries: number;
  veterinary: { pending: number; approved: number; rejected: number; absent: number };
  judging: { totalJudges: number; closedForms: number; selected: number; discarded: number; disqualified: number };
  judge?: {
    faFormStatus: "PENDING" | "STARTED" | "CLOSED" | null;
    roundFormStatus: JudgingRoundFormStatus | null;
    currentRoundType: JudgingRoundType | null;
    formats: JudgeFormatDto[];
  };
};

const JUDGING_PHASE_STATUSES: FairCategoryStageStatus[] = [
  "JUDGING_STARTED",
  "FA_CONSOLIDATED",
  "F1_IN_PROGRESS",
  "F1_CONSOLIDATED",
  "F2_IN_PROGRESS",
  "TIE_BREAK_IN_PROGRESS",
  "JUDGING_DESERTED",
  "JUDGING_CLOSED"
];

function assertJudgeStageVisible(stage: FairCategoryStage): void {
  if (!JUDGING_PHASE_STATUSES.includes(stage.status)) {
    throw new NotFoundError("La categoria no esta disponible para juzgamiento.");
  }
}

async function getEntries(manager: EntityManager, stage: FairCategoryStage): Promise<FairEntry[]> {
  return manager.getRepository(FairEntry).find({
    where: { fairId: stage.fairId, categoryId: stage.categoryId },
    order: { trackPosition: "ASC" }
  });
}

async function ensureVeterinaryChecks(manager: EntityManager, stage: FairCategoryStage): Promise<void> {
  const entries = await getEntries(manager, stage);
  const existing = await manager.getRepository(VeterinaryCheck).find({
    where: { fairCategoryStageId: stage.id },
    select: { fairEntryId: true }
  });
  const existingIds = new Set(existing.map((check) => check.fairEntryId));
  const missing = entries
    .filter((entry) => !existingIds.has(entry.id))
    .map((entry) =>
      manager.getRepository(VeterinaryCheck).create({
        fairCategoryStageId: stage.id,
        fairEntryId: entry.id,
        veterinarianUserId: null,
        status: "PENDING",
        notes: null,
        checkedAt: null
      })
    );

  if (missing.length > 0) {
    await manager.getRepository(VeterinaryCheck).save(missing);
  }
}

export async function buildStageSummary(manager: EntityManager, stage: FairCategoryStage): Promise<StagedCategoryDto> {
  const [summary] = await buildStageSummaries(manager, [stage]);
  return summary;
}

async function buildStageSummaries(
  manager: EntityManager,
  stages: FairCategoryStage[]
): Promise<StagedCategoryDto[]> {
  if (stages.length === 0) {
    return [];
  }

  const stageIds = stages.map((stage) => stage.id);
  const fairIds = [...new Set(stages.map((stage) => stage.fairId))];

  const entryCountRows = await manager
    .getRepository(FairEntry)
    .createQueryBuilder("entry")
    .select("entry.fair_id", "fairId")
    .addSelect("entry.category_id", "categoryId")
    .addSelect("COUNT(entry.id)", "total")
    .where(
      new Brackets((qb) => {
        for (const [index, stage] of stages.entries()) {
          qb.orWhere(
            `(entry.fair_id = :fairId${index} AND entry.category_id = :categoryId${index})`,
            {
              [`fairId${index}`]: stage.fairId,
              [`categoryId${index}`]: stage.categoryId
            }
          );
        }
      })
    )
    .groupBy("entry.fair_id")
    .addGroupBy("entry.category_id")
    .getRawMany<{ fairId: string; categoryId: string; total: string }>();

  const checks = await manager.getRepository(VeterinaryCheck).find({
    where: { fairCategoryStageId: In(stageIds) }
  });
  const forms = await manager.getRepository(FaJudgeForm).find({
    where: { fairCategoryStageId: In(stageIds) }
  });
  const decisions = await manager.getRepository(FaJudgeEntryDecision).find({
    where: { faJudgeForm: { fairCategoryStageId: In(stageIds) } },
    relations: { faJudgeForm: true }
  });

  const judgeCountByFairId = new Map<string, number>();
  for (const fairId of fairIds) {
    const judges = await getUsersByFairRole(manager, fairId, "2");
    judgeCountByFairId.set(fairId, judges.length);
  }

  const entryCountByPair = new Map(
    entryCountRows.map((row) => [`${row.fairId}:${row.categoryId}`, Number(row.total)])
  );
  const checksByStageId = new Map<string, VeterinaryCheck[]>();
  for (const check of checks) {
    const current = checksByStageId.get(check.fairCategoryStageId) ?? [];
    current.push(check);
    checksByStageId.set(check.fairCategoryStageId, current);
  }
  const formsByStageId = new Map<string, FaJudgeForm[]>();
  for (const form of forms) {
    const current = formsByStageId.get(form.fairCategoryStageId) ?? [];
    current.push(form);
    formsByStageId.set(form.fairCategoryStageId, current);
  }
  const decisionsByStageId = new Map<string, FaJudgeEntryDecision[]>();
  for (const decision of decisions) {
    const stageId = decision.faJudgeForm.fairCategoryStageId;
    const current = decisionsByStageId.get(stageId) ?? [];
    current.push(decision);
    decisionsByStageId.set(stageId, current);
  }

  return stages.map((stage) => {
    const stageChecks = checksByStageId.get(stage.id) ?? [];
    const stageForms = formsByStageId.get(stage.id) ?? [];
    const stageDecisions = decisionsByStageId.get(stage.id) ?? [];

    return {
      stageId: stage.id,
      revision: stage.revision,
      status: stage.status,
      fair: { id: stage.fair.id, name: stage.fair.name },
      category: {
        id: stage.category.id,
        name: stage.category.name,
        minAgeMonths: Number(stage.category.minAgeMonths),
        maxAgeMonths: Number(stage.category.maxAgeMonths)
      },
      gait: {
        id: stage.category.gait.id,
        name: stage.category.gait.name
      },
      totalEntries: entryCountByPair.get(`${stage.fairId}:${stage.categoryId}`) ?? 0,
      veterinary: {
        pending: stageChecks.filter((check) => check.status === "PENDING").length,
        approved: stageChecks.filter((check) => check.status === "APPROVED").length,
        rejected: stageChecks.filter((check) => check.status === "REJECTED").length,
        absent: stageChecks.filter((check) => check.status === "ABSENT").length
      },
      judging: {
        totalJudges: judgeCountByFairId.get(stage.fairId) ?? 0,
        closedForms: stageForms.filter((form) => form.status === "CLOSED").length,
        selected: stageDecisions.filter((decision) => decision.decision === "SELECTED").length,
        discarded: stageDecisions.filter((decision) => decision.decision === "DISCARDED").length,
        disqualified: stageDecisions.filter((decision) => decision.decision === "DISQUALIFIED").length
      }
    };
  });
}

const ROLES_SEE_ONLY_STARTED_STAGES: UserRole[] = ["JUDGE", "VETERINARIAN"];

export async function listStagesFromFairEntries(
  manager: EntityManager,
  personId: string,
  roleExternalId: string
): Promise<FairCategoryStage[]> {
  const query = manager
    .getRepository(FairEntry)
    .createQueryBuilder("entry")
    .innerJoin("entry.fair", "fair")
    .innerJoin("entry.category", "category")
    .innerJoin("category.gait", "gait")
    .innerJoin(FairStaff, "staff", "staff.fair_id = entry.fair_id")
    .innerJoin(Role, "role", "role.id = staff.role_id")
    .select("fair.id", "fairId")
    .addSelect("category.id", "categoryId")
    .where("staff.person_id = :personId", { personId })
    .andWhere("role.external_id = :roleExternalId", { roleExternalId });
  filterIndividualJudgingCategories(query);
  const rows = await query
    .groupBy("fair.id")
    .addGroupBy("category.id")
    .orderBy("fair.id", "ASC")
    .addOrderBy("category.id", "ASC")
    .getRawMany<{ fairId: string; categoryId: string }>();

  if (rows.length === 0) {
    return [];
  }

  const existing = await manager.getRepository(FairCategoryStage).find({
    where: rows.map((row) => ({ fairId: row.fairId, categoryId: row.categoryId })),
    relations: { fair: true, category: { gait: true } }
  });
  const existingKeys = new Set(existing.map((stage) => `${stage.fairId}:${stage.categoryId}`));
  const missing = rows.filter((row) => !existingKeys.has(`${row.fairId}:${row.categoryId}`));

  if (missing.length > 0) {
    await manager.getRepository(FairCategoryStage).save(
      missing.map((row) =>
        manager.getRepository(FairCategoryStage).create({
          fairId: row.fairId,
          categoryId: row.categoryId,
          status: "NOT_STARTED",
          preRingStartedAt: null,
          preRingStartedByUserId: null,
          preRingClosedAt: null,
          preRingClosedByUserId: null,
          judgingStartedAt: null,
          judgingStartedByUserId: null,
          faConsolidatedAt: null,
          faConsolidatedByUserId: null,
          judgingClosedAt: null,
          judgingClosedByUserId: null,
          desertedAt: null,
          desertedByUserId: null,
          desertedReason: null
        })
      )
    );
  }

  const stages = await manager.getRepository(FairCategoryStage).find({
    where: rows.map((row) => ({ fairId: row.fairId, categoryId: row.categoryId })),
    relations: { fair: true, category: { gait: true } }
  });
  const byKey = new Map(stages.map((stage) => [`${stage.fairId}:${stage.categoryId}`, stage]));
  return rows
    .map((row) => byKey.get(`${row.fairId}:${row.categoryId}`))
    .filter((stage): stage is FairCategoryStage => Boolean(stage));
}

export async function listStagesForAssignedStaff(
  manager: EntityManager,
  personId: string,
  roleExternalId: string,
  visibleStatuses: FairCategoryStageStatus[] | "ANY_STARTED"
): Promise<FairCategoryStage[]> {
  const query = manager
    .getRepository(FairCategoryStage)
    .createQueryBuilder("stage")
    .innerJoinAndSelect("stage.fair", "fair")
    .innerJoinAndSelect("stage.category", "category")
    .innerJoinAndSelect("category.gait", "gait")
    .innerJoin(FairStaff, "staff", "staff.fair_id = stage.fair_id")
    .innerJoin(Role, "role", "role.id = staff.role_id")
    .where("staff.person_id = :personId", { personId })
    .andWhere("role.external_id = :roleExternalId", { roleExternalId });
  filterIndividualJudgingCategories(query);

  if (visibleStatuses === "ANY_STARTED") {
    query.andWhere("stage.status != :notStarted", { notStarted: "NOT_STARTED" });
  } else {
    query.andWhere("stage.status IN (:...statuses)", { statuses: visibleStatuses });
  }

  return query.orderBy("fair.id", "ASC").addOrderBy("category.id", "ASC").getMany();
}

async function countRoundFormParticipants(
  manager: EntityManager,
  roundId: string,
  judgeUserId: string
): Promise<number> {
  const form = await manager.getRepository(JudgingRoundForm).findOne({
    where: { roundId, judgeUserId },
    select: { id: true }
  });

  if (form) {
    return manager.getRepository(JudgingRoundEntry).count({ where: { roundFormId: form.id } });
  }

  const fallbackForm = await manager.getRepository(JudgingRoundForm).findOne({
    where: { roundId },
    select: { id: true }
  });

  if (!fallbackForm) {
    return 0;
  }

  return manager.getRepository(JudgingRoundEntry).count({ where: { roundFormId: fallbackForm.id } });
}

async function buildRoundFormatDto(
  manager: EntityManager,
  stageId: string,
  userId: string,
  roundType: JudgingRoundType,
  stageStatus: FairCategoryStageStatus
): Promise<JudgeFormatDto> {
  const round = await manager.getRepository(JudgingRound).findOne({
    where: { fairCategoryStageId: stageId, roundType },
    order: { createdAt: "DESC" },
    select: { id: true, status: true, roundType: true }
  });

  if (!round) {
    return {
      key: roundType,
      formStatus: "NOT_AVAILABLE",
      isActive: false,
      participantCount: null
    };
  }

  const form = await manager.getRepository(JudgingRoundForm).findOne({
    where: { roundId: round.id, judgeUserId: userId },
    select: { status: true }
  });
  const formStatus = (form?.status ?? "PENDING") as JudgeFormatStatus;
  const participantCount = await countRoundFormParticipants(manager, round.id, userId);
  const isActive =
    round.status === "OPEN" &&
    stageStatus !== "JUDGING_DESERTED" &&
    stageStatus !== "JUDGING_CLOSED" &&
    (formStatus === "PENDING" || formStatus === "STARTED");

  return {
    key: roundType,
    formStatus,
    isActive,
    participantCount: participantCount > 0 ? participantCount : null
  };
}

function buildFaFormatDto(
  stageStatus: FairCategoryStageStatus,
  faForm: Pick<FaJudgeForm, "status"> | null
): JudgeFormatDto {
  if (!JUDGING_PHASE_STATUSES.includes(stageStatus)) {
    return { key: "FA", formStatus: "NOT_AVAILABLE", isActive: false, participantCount: null };
  }

  const formStatus = (faForm?.status ?? "PENDING") as JudgeFormatStatus;
  const isActive =
    stageStatus === "JUDGING_STARTED" && (formStatus === "PENDING" || formStatus === "STARTED");

  return { key: "FA", formStatus, isActive, participantCount: null };
}

async function enrichForJudge(
  manager: EntityManager,
  items: StagedCategoryDto[],
  userId: string
): Promise<StagedCategoryDto[]> {
  if (items.length === 0) {
    return [];
  }

  const stageIds = items.map((item) => item.stageId);
  const faForms = await manager.getRepository(FaJudgeForm).find({
    where: { fairCategoryStageId: In(stageIds), judgeUserId: userId },
    select: { fairCategoryStageId: true, status: true }
  });
  const activeRounds = await manager.getRepository(JudgingRound).find({
    where: { fairCategoryStageId: In(stageIds), status: "OPEN" },
    order: { createdAt: "DESC" },
    select: { id: true, roundType: true, fairCategoryStageId: true, createdAt: true }
  });

  const faFormByStageId = new Map(faForms.map((form) => [form.fairCategoryStageId, form]));
  const activeRoundByStageId = new Map<string, (typeof activeRounds)[number]>();
  for (const round of activeRounds) {
    if (!activeRoundByStageId.has(round.fairCategoryStageId)) {
      activeRoundByStageId.set(round.fairCategoryStageId, round);
    }
  }

  const enriched: StagedCategoryDto[] = [];
  for (const item of items) {
    const faForm = faFormByStageId.get(item.stageId) ?? null;
    const activeRound = activeRoundByStageId.get(item.stageId) ?? null;
    const f1Format = await buildRoundFormatDto(manager, item.stageId, userId, "F1", item.status);
    const f2Format = await buildRoundFormatDto(manager, item.stageId, userId, "F2", item.status);
    const tieBreakFormat = await buildRoundFormatDto(
      manager,
      item.stageId,
      userId,
      "TIE_BREAK",
      item.status
    );

    let roundForm: Pick<JudgingRoundForm, "status"> | null = null;
    if (activeRound) {
      roundForm = await manager.getRepository(JudgingRoundForm).findOne({
        where: { roundId: activeRound.id, judgeUserId: userId },
        select: { status: true }
      });
    }

    const faFormat = buildFaFormatDto(item.status, faForm);
    const formats: JudgeFormatDto[] = [faFormat, f1Format, f2Format];
    if (tieBreakFormat.formStatus !== "NOT_AVAILABLE") {
      formats.push(tieBreakFormat);
    }

    enriched.push({
      ...item,
      judge: {
        faFormStatus: faForm?.status ?? null,
        roundFormStatus: roundForm?.status ?? null,
        currentRoundType: activeRound?.roundType ?? null,
        formats
      }
    });
  }

  return enriched;
}

export async function listStagedCategories(user: User): Promise<StagedCategoryDto[]> {
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    if (!user.personId) {
      throw new ForbiddenError("El usuario no esta asociado a una persona.");
    }

    const roleExternalId = roleExternalIdForUser(user);
    const stages = ROLES_SEE_ONLY_STARTED_STAGES.includes(user.role)
      ? await listStagesForAssignedStaff(manager, user.personId, roleExternalId, "ANY_STARTED")
      : await listStagesFromFairEntries(manager, user.personId, roleExternalId);

    const summaries = await buildStageSummaries(manager, stages);

    if (user.role === "JUDGE") {
      return enrichForJudge(manager, summaries, user.id);
    }

    return summaries;
  });
}

export async function getStagedCategory(user: User, stageId: string): Promise<StagedCategoryDto> {
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage);

    if (user.role === "JUDGE") {
      assertJudgeStageVisible(stage);
    }

    let summary = await buildStageSummary(manager, stage);

    if (user.role === "JUDGE") {
      const [enriched] = await enrichForJudge(manager, [summary], user.id);
      summary = enriched;
    }

    return summary;
  });
}

export async function startPreRing(user: User, stageId: string): Promise<StagedCategoryDto> {
  assertUserRole(user, ["TECHNICAL_DIRECTOR"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["3"]);

    if (stage.status !== "NOT_STARTED") {
      throw new BadRequestError("La pre-pista solo puede iniciarse desde estado Sin iniciar.");
    }

    const previousStatus = stage.status;
    stage.status = "PRE_RING_STARTED";
    stage.preRingStartedAt = new Date();
    stage.preRingStartedByUserId = user.id;
    await manager.getRepository(FairCategoryStage).save(stage);
    await ensureVeterinaryChecks(manager, stage);
    await recordEvent(manager, {
      stageId: stage.id,
      userId: user.id,
      eventType: "PRE_RING_STARTED",
      fromStatus: previousStatus,
      toStatus: stage.status
    });
    const notification = stageNotificationContext(stage);
    await queueRoleNotifications(manager, stage, "Z", {
      type: "PRE_RING_STARTED",
      title: `Pre-pista iniciada - ${notification.titleSuffix}`,
      body: `Ya puedes realizar el checkeo veterinario de ${notification.detail}.`,
      payload: notification.payload
    });

    return buildStageSummary(manager, await getStageOrThrow(manager, stage.id));
  });
}

export async function listVeterinaryChecks(user: User, stageId: string) {
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage);
    return listVeterinaryChecksForStage(manager, stage);
  });
}

async function listVeterinaryChecksForStage(manager: EntityManager, stage: FairCategoryStage) {
  await ensureVeterinaryChecks(manager, stage);

  const checks = await manager.getRepository(VeterinaryCheck).find({
    where: { fairCategoryStageId: stage.id },
    relations: { fairEntry: { horse: true } },
    order: { fairEntry: { trackPosition: "ASC" } }
  });

  return checks.map((check) => ({
    id: check.id,
    revision: check.revision,
    fairEntryId: check.fairEntryId,
    trackPosition: check.fairEntry.trackPosition,
    horseName: check.fairEntry.horse?.name?.trim() || "",
    riderName: check.fairEntry.riderName,
    registrationNumber: check.fairEntry.registrationNumber,
    status: check.status,
    notes: check.notes
  }));
}

export async function updateVeterinaryCheck(
  user: User,
  stageId: string,
  fairEntryId: string,
  input:
    | { status: VeterinaryCheckStatus; notes?: string | null }
    | {
        operationId: string;
        baseRevision: number;
        clientUpdatedAt: string;
        payload: { status: VeterinaryCheckStatus; notes?: string | null };
      }
): Promise<{ checks: Awaited<ReturnType<typeof listVeterinaryChecksForStage>>; sync?: MutationSyncMeta }> {
  assertUserRole(user, ["VETERINARIAN"]);
  const dataSource = await getDataSource();
  const isOfflineEnvelope = "operationId" in input && "payload" in input;
  const payload = isOfflineEnvelope ? input.payload : input;

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["Z"]);

    if (stage.status !== "PRE_RING_STARTED") {
      if (isOfflineEnvelope) {
        throw new StageAdvancedError(stage.id);
      }
      throw new BadRequestError("El checkeo veterinario solo se puede editar con pre-pista iniciada.");
    }

    await ensureVeterinaryChecks(manager, stage);
    const check = await manager.getRepository(VeterinaryCheck).findOne({
      where: { fairCategoryStageId: stage.id, fairEntryId },
      lock: { mode: "pessimistic_write" }
    });

    if (!check) {
      throw new NotFoundError("No se encontro el participante para checkeo veterinario.");
    }

    const applyUpdate = async () => {
      if (isOfflineEnvelope) {
        assertExpectedRevision(input.baseRevision, check.revision, {
          aggregateId: check.id,
          currentState: {
            id: check.id,
            fairEntryId: check.fairEntryId,
            status: check.status,
            notes: check.notes,
            revision: check.revision
          },
          resolution: "CAN_REAPPLY_LOCAL_DRAFT"
        });
      }

      check.status = payload.status;
      check.notes = payload.notes ?? null;
      check.veterinarianUserId = user.id;
      check.checkedAt = payload.status === "PENDING" ? null : new Date();
      const saved = await manager.getRepository(VeterinaryCheck).save(check);
      const checks = await listVeterinaryChecksForStage(manager, stage);
      return {
        responsePayload: checks,
        appliedRevision: saved.revision
      };
    };

    if (!isOfflineEnvelope) {
      const applied = await applyUpdate();
      return { checks: applied.responsePayload };
    }

    const result = await executeIdempotentMutation(manager, {
      operationId: input.operationId,
      userId: user.id,
      stageId: stage.id,
      aggregateType: "VET_CHECK",
      aggregateId: check.id,
      operationType: "UPDATE_VET_CHECK",
      baseRevision: input.baseRevision,
      requestPayload: payload,
      apply: applyUpdate
    });

    return {
      checks: result.responsePayload,
      sync: {
        operationId: input.operationId,
        applied: !result.duplicate,
        duplicate: result.duplicate,
        revision: result.appliedRevision ?? check.revision,
        serverUpdatedAt: new Date().toISOString()
      }
    };
  });
}

export async function closePreRing(user: User, stageId: string): Promise<StagedCategoryDto> {
  assertUserRole(user, ["VETERINARIAN"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["Z"]);

    if (stage.status !== "PRE_RING_STARTED") {
      throw new BadRequestError("La pre-pista solo puede cerrarse cuando esta iniciada.");
    }

    await ensureVeterinaryChecks(manager, stage);
    const checks = await manager.getRepository(VeterinaryCheck).find({
      where: { fairCategoryStageId: stage.id }
    });

    if (checks.length === 0 || checks.some((check) => check.status === "PENDING")) {
      throw new BadRequestError("Todos los participantes deben tener decision veterinaria.");
    }

    const previousStatus = stage.status;
    stage.status = "PRE_RING_CLOSED";
    stage.preRingClosedAt = new Date();
    stage.preRingClosedByUserId = user.id;
    await manager.getRepository(FairCategoryStage).save(stage);
    await recordEvent(manager, {
      stageId: stage.id,
      userId: user.id,
      eventType: "PRE_RING_CLOSED",
      fromStatus: previousStatus,
      toStatus: stage.status
    });
    const notification = stageNotificationContext(stage);
    await queueRoleNotifications(manager, stage, "3", {
      type: "PRE_RING_CLOSED",
      title: `Pre-pista cerrada - ${notification.titleSuffix}`,
      body: `El checkeo veterinario de ${notification.detail} fue cerrado. Los aprobados estan listos para juzgamiento.`,
      payload: notification.payload
    });

    return buildStageSummary(manager, await getStageOrThrow(manager, stage.id));
  });
}

export async function startJudging(user: User, stageId: string): Promise<StagedCategoryDto> {
  assertUserRole(user, ["TECHNICAL_DIRECTOR"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["3"]);

    if (stage.status !== "PRE_RING_CLOSED") {
      throw new BadRequestError("El juzgamiento requiere pre-pista cerrada.");
    }

    const approvedChecks = await manager.getRepository(VeterinaryCheck).find({
      where: { fairCategoryStageId: stage.id, status: "APPROVED" }
    });

    if (approvedChecks.length === 0) {
      throw new BadRequestError("No hay participantes aprobados para juzgamiento.");
    }

    for (const check of approvedChecks) {
      await manager.getRepository(JudgingParticipant).upsert(
        {
          fairCategoryStageId: stage.id,
          fairEntryId: check.fairEntryId,
          status: "ELIGIBLE",
          disqualifiedByJudgeFormId: null,
          disqualificationReasonId: null,
          disqualifiedAt: null
        },
        ["fairCategoryStageId", "fairEntryId"]
      );
    }

    const judges = await getUsersByFairRole(manager, stage.fairId, "2");
    for (const judge of judges) {
      await manager.getRepository(FaJudgeForm).upsert(
        {
          fairCategoryStageId: stage.id,
          judgeUserId: judge.id,
          status: "PENDING",
          startedAt: null,
          closedAt: null
        },
        ["fairCategoryStageId", "judgeUserId"]
      );
    }

    const previousStatus = stage.status;
    stage.status = "JUDGING_STARTED";
    stage.judgingStartedAt = new Date();
    stage.judgingStartedByUserId = user.id;
    stage.desertedAt = null;
    stage.desertedByUserId = null;
    stage.desertedReason = null;
    await manager.getRepository(FairCategoryStage).save(stage);
    await recordEvent(manager, {
      stageId: stage.id,
      userId: user.id,
      eventType: "JUDGING_STARTED",
      fromStatus: previousStatus,
      toStatus: stage.status
    });
    const notification = stageNotificationContext(stage);
    await queueRoleNotifications(manager, stage, "2", {
      type: "JUDGING_STARTED",
      title: `Juzgamiento iniciado - ${notification.titleSuffix}`,
      body: `El director tecnico inicio el juzgamiento de ${notification.detail}.`,
      payload: notification.payload
    });
    await queueRoleNotifications(manager, stage, "Z", {
      type: "JUDGING_STARTED",
      title: `Juzgamiento iniciado - ${notification.titleSuffix}`,
      body: `El director tecnico inicio el juzgamiento de ${notification.detail}.`,
      payload: notification.payload
    });

    return buildStageSummary(manager, await getStageOrThrow(manager, stage.id));
  });
}

async function getJudgeFormOrCreate(
  manager: EntityManager,
  stage: FairCategoryStage,
  user: User
): Promise<FaJudgeForm> {
  let form = await manager.getRepository(FaJudgeForm).findOne({
    where: { fairCategoryStageId: stage.id, judgeUserId: user.id }
  });

  if (form) {
    return form;
  }

  form = manager.getRepository(FaJudgeForm).create({
    fairCategoryStageId: stage.id,
    judgeUserId: user.id,
    status: "PENDING",
    startedAt: null,
    closedAt: null
  });

  return manager.getRepository(FaJudgeForm).save(form);
}

async function getJudgeFormForUpdate(
  manager: EntityManager,
  stage: FairCategoryStage,
  user: User
): Promise<FaJudgeForm> {
  const form = await getJudgeFormOrCreate(manager, stage, user);
  const lockedForm = await manager.getRepository(FaJudgeForm).findOne({
    where: { id: form.id },
    lock: { mode: "pessimistic_write" }
  });

  if (!lockedForm) {
    throw new NotFoundError("No se encontró el formulario FA del juez.");
  }

  return lockedForm;
}

async function validateFaSelection(
  manager: EntityManager,
  stage: FairCategoryStage,
  selectedParticipantIds: string[]
): Promise<string[]> {
  if (selectedParticipantIds.length > 10) {
    throw new BadRequestError("Solo se pueden seleccionar máximo 10 participantes.");
  }

  const uniqueIds = Array.from(new Set(selectedParticipantIds));
  if (uniqueIds.length !== selectedParticipantIds.length) {
    throw new BadRequestError("La selección contiene participantes repetidos.");
  }

  if (uniqueIds.length === 0) {
    return uniqueIds;
  }

  const participants = await manager.getRepository(JudgingParticipant).findByIds(uniqueIds);
  if (participants.length !== uniqueIds.length) {
    throw new BadRequestError("La selección contiene participantes inválidos.");
  }

  if (
    participants.some(
      (participant) =>
        participant.fairCategoryStageId !== stage.id || participant.status !== "ELIGIBLE"
    )
  ) {
    throw new BadRequestError("Solo se pueden seleccionar participantes elegibles de esta categoría.");
  }

  return uniqueIds;
}

async function replaceFaSelections(
  manager: EntityManager,
  form: FaJudgeForm,
  selectedParticipantIds: string[]
): Promise<void> {
  await manager.getRepository(FaJudgeEntryDecision).delete({
    faJudgeFormId: form.id,
    decision: "SELECTED"
  });

  if (selectedParticipantIds.length === 0) return;

  await manager.getRepository(FaJudgeEntryDecision).save(
    selectedParticipantIds.map((participantId, index) =>
      manager.getRepository(FaJudgeEntryDecision).create({
        faJudgeFormId: form.id,
        judgingParticipantId: participantId,
        decision: "SELECTED",
        selectionOrder: index + 1,
        disqualificationReasonId: null
      })
    )
  );
}

export async function startFa(user: User, stageId: string) {
  assertUserRole(user, ["JUDGE"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["2"]);
    assertJudgeStageVisible(stage);

    if (stage.status !== "JUDGING_STARTED") {
      throw new BadRequestError("El FA solo puede iniciarse con juzgamiento iniciado.");
    }

    const form = await getJudgeFormOrCreate(manager, stage, user);

    if (form.status === "CLOSED") {
      throw new BadRequestError("El FA ya esta cerrado.");
    }

    if (form.status === "PENDING") {
      form.status = "STARTED";
      form.startedAt = new Date();
      await manager.getRepository(FaJudgeForm).save(form);
      await recordEvent(manager, {
        stageId: stage.id,
        userId: user.id,
        eventType: "FA_STARTED"
      });
    } else if (form.status === "STARTED" && !form.startedAt) {
      form.startedAt = stage.judgingStartedAt ?? new Date();
      await manager.getRepository(FaJudgeForm).save(form);
    }

    return getFaForStage(manager, user, stage);
  });
}

export async function getFa(user: User, stageId: string) {
  assertUserRole(user, ["JUDGE"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["2"]);
    assertJudgeStageVisible(stage);
    return getFaForStage(manager, user, stage);
  });
}

async function getFaForStage(manager: EntityManager, user: User, stage: FairCategoryStage) {
  const form = await getJudgeFormOrCreate(manager, stage, user);
  const [participants, decisions, reasons, consolidatedRows, faForms, stageDisqualifyDecisions, repeatTrackRequests] =
    await Promise.all([
      manager.getRepository(JudgingParticipant).find({
        where: { fairCategoryStageId: stage.id },
        relations: { fairEntry: { horse: true }, disqualificationReason: true, disqualifiedByUser: { person: true } },
        order: { fairEntry: { trackPosition: "ASC" } }
      }),
      manager.getRepository(FaJudgeEntryDecision).find({
        where: { faJudgeFormId: form.id },
        relations: { disqualificationReason: true }
      }),
      manager.getRepository(DisqualificationReason).find({
        where: { isActive: true },
        order: { code: "ASC" }
      }),
      manager.getRepository(FaConsolidatedResult).find({
        where: { fairCategoryStageId: stage.id },
        relations: { judgingParticipant: { fairEntry: true } },
        order: { finalPosition: "ASC" }
      }),
      manager.getRepository(FaJudgeForm).find({
        where: { fairCategoryStageId: stage.id },
        relations: { judgeUser: { person: true } }
      }),
      manager.getRepository(FaJudgeEntryDecision).find({
        where: {
          decision: "DISQUALIFIED",
          faJudgeForm: { fairCategoryStageId: stage.id }
        },
        relations: { faJudgeForm: { judgeUser: { person: true } } }
      }),
      manager.getRepository(FaRepeatTrackRequest).find({
        where: { fairCategoryStageId: stage.id },
        relations: { requestedByUser: { person: true } }
      })
    ]);
  const decisionsByParticipantId = new Map(decisions.map((decision) => [decision.judgingParticipantId, decision]));
  const repeatRequestByParticipantId = new Map(
    repeatTrackRequests.map((request) => [request.judgingParticipantId, request])
  );
  const judgeByFaFormId = new Map(faForms.map((faForm) => [faForm.id, faForm.judgeUser]));
  const judgeByDisqualifyDecision = new Map(
    stageDisqualifyDecisions.map((decision) => [decision.judgingParticipantId, decision.faJudgeForm.judgeUser])
  );

  return {
    stage: await buildStageSummary(manager, stage),
    form: {
      id: form.id,
      revision: form.revision,
      status: form.status,
      selectedCount: decisions.filter((decision) => decision.decision === "SELECTED").length,
      disqualifiedCount: decisions.filter((decision) => decision.decision === "DISQUALIFIED").length,
      discardedCount: decisions.filter((decision) => decision.decision === "DISCARDED").length,
      closedAt: form.closedAt?.toISOString() ?? null
    },
    consolidated: consolidatedRows.map((result) => ({
      id: result.id,
      trackPosition: result.judgingParticipant.fairEntry.trackPosition,
      votesCount: result.votesCount,
      finalPosition: result.finalPosition
    })),
    participants: participants.map((participant) => {
      const decision = decisionsByParticipantId.get(participant.id);
      const repeatTrackRequest = repeatRequestByParticipantId.get(participant.id) ?? null;
      const disqualifiedBy =
        toDisqualifiedByDto(participant.disqualifiedByUser) ??
        toDisqualifiedByDto(
          participant.disqualifiedByJudgeFormId
            ? judgeByFaFormId.get(participant.disqualifiedByJudgeFormId)
            : null
        ) ??
        toDisqualifiedByDto(judgeByDisqualifyDecision.get(participant.id));

      return {
        id: participant.id,
        fairEntryId: participant.fairEntryId,
        trackPosition: participant.fairEntry.trackPosition,
        horseName: participant.fairEntry.horse?.name?.trim() || "",
        riderName: participant.fairEntry.riderName,
        registrationNumber: participant.fairEntry.registrationNumber,
        status: participant.status,
        disqualificationReason: participant.disqualificationReason
          ? {
              id: participant.disqualificationReason.id,
              code: participant.disqualificationReason.code,
              name: participant.disqualificationReason.name,
              description: participant.disqualificationReason.description
            }
          : null,
        disqualifiedBy,
        repeatTrackRequest: repeatTrackRequest
          ? {
              id: repeatTrackRequest.id,
              status: repeatTrackRequest.status,
              requestedAt: repeatTrackRequest.requestedAt.toISOString(),
              executedAt: repeatTrackRequest.executedAt?.toISOString() ?? null,
              requestedBy: toDisqualifiedByDto(repeatTrackRequest.requestedByUser)
            }
          : null,
        decision: decision
          ? {
              id: decision.id,
              decision: decision.decision,
              selectionOrder: decision.selectionOrder,
              disqualificationReason: decision.disqualificationReason
                ? {
                    id: decision.disqualificationReason.id,
                    code: decision.disqualificationReason.code,
                    name: decision.disqualificationReason.name
                  }
                : null
            }
          : null
      };
    }),
    disqualificationReasons: reasons.map((reason) => ({
      id: reason.id,
      code: reason.code,
      name: reason.name,
      description: reason.description
    }))
  };
}

export async function requestFaRepeatTrack(user: User, stageId: string, judgingParticipantId: string) {
  assertUserRole(user, ["JUDGE"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["2"]);
    if (stage.status !== "JUDGING_STARTED") {
      throw new BadRequestError("Solo se puede solicitar repetir pista durante el juzgamiento activo.");
    }

    const form = await getJudgeFormOrCreate(manager, stage, user);
    if (form.status !== "STARTED") {
      throw new BadRequestError("Solo se puede solicitar repetir pista con FA iniciado.");
    }

    const participant = await manager.getRepository(JudgingParticipant).findOne({
      where: { id: judgingParticipantId, fairCategoryStageId: stage.id },
      relations: { fairEntry: true }
    });

    if (!participant) {
      throw new NotFoundError("No se encontro el participante de juzgamiento.");
    }

    if (participant.status !== "ELIGIBLE") {
      throw new BadRequestError("No se puede solicitar repetir pista para un ejemplar descalificado.");
    }

    const existing = await manager.getRepository(FaRepeatTrackRequest).findOne({
      where: { fairCategoryStageId: stage.id, judgingParticipantId: participant.id }
    });

    if (existing) {
      throw new BadRequestError("Ya existe una solicitud de repetir pista para este ejemplar en el FA.");
    }

    const now = new Date();
    const request = await manager.getRepository(FaRepeatTrackRequest).save(
      manager.getRepository(FaRepeatTrackRequest).create({
        fairCategoryStageId: stage.id,
        faJudgeFormId: form.id,
        judgingParticipantId: participant.id,
        requestedByUserId: user.id,
        status: "PENDING",
        requestedAt: now,
        executedAt: null,
        executedByUserId: null
      })
    );

    await recordEvent(manager, {
      stageId: stage.id,
      userId: user.id,
      eventType: "FA_REPEAT_TRACK_REQUESTED",
      payload: { requestId: request.id, judgingParticipantId: participant.id, faJudgeFormId: form.id }
    });

    const notification = stageNotificationContext(stage);
    const judgeName = formatStaffDisplayName(user);
    await queueRoleNotifications(manager, stage, "3", {
      type: "FA_REPEAT_TRACK_REQUESTED",
      title: `Solicitud repetir pista - ${notification.titleSuffix}`,
      body: `${judgeName} solicito repetir pista para el ejemplar #${participant.fairEntry.trackPosition}. Categoria: ${notification.detail}.`,
      payload: {
        ...notification.payload,
        requestId: request.id,
        judgingParticipantId: participant.id,
        trackPosition: participant.fairEntry.trackPosition,
        requestedByUserId: user.id,
        requestedByName: judgeName
      }
    });

    return getFaForStage(manager, user, stage);
  });
}

export async function executeFaRepeatTrackRequest(user: User, stageId: string, requestId: string) {
  assertUserRole(user, ["TECHNICAL_DIRECTOR"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["3"]);
    const request = await manager.getRepository(FaRepeatTrackRequest).findOne({
      where: { id: requestId, fairCategoryStageId: stage.id },
      relations: { judgingParticipant: { fairEntry: true } }
    });

    if (!request) {
      throw new NotFoundError("No se encontro la solicitud de repetir pista.");
    }

    if (request.status !== "PENDING") {
      throw new BadRequestError("La solicitud de repetir pista ya fue ejecutada.");
    }

    request.status = "EXECUTED";
    request.executedAt = new Date();
    request.executedByUserId = user.id;
    await manager.getRepository(FaRepeatTrackRequest).save(request);

    await recordEvent(manager, {
      stageId: stage.id,
      userId: user.id,
      eventType: "FA_REPEAT_TRACK_EXECUTED",
      payload: { requestId: request.id, judgingParticipantId: request.judgingParticipantId }
    });

    return getManagementForStage(manager, stage);
  });
}

export async function updateFaDecisions(
  user: User,
  stageId: string,
  input:
    | { selectedParticipantIds: string[] }
    | {
        operationId: string;
        baseRevision: number;
        clientUpdatedAt: string;
        payload: { selectedParticipantIds: string[] };
      }
): Promise<{ fa: Awaited<ReturnType<typeof getFaForStage>>; sync?: MutationSyncMeta }> {
  assertUserRole(user, ["JUDGE"]);
  const dataSource = await getDataSource();
  const isOfflineEnvelope = "operationId" in input && "payload" in input;
  const payload = isOfflineEnvelope ? input.payload : input;

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["2"]);
    if (stage.status !== "JUDGING_STARTED") {
      if (isOfflineEnvelope) {
        throw new StageAdvancedError(stage.id);
      }
      throw new BadRequestError("El FA no se puede editar porque el juzgamiento ya no esta activo.");
    }
    const form = await getJudgeFormForUpdate(manager, stage, user);

    if (form.status !== "STARTED") {
      if (isOfflineEnvelope) {
        throw new FormClosedError(form.id);
      }
      throw new BadRequestError("Solo se puede editar un FA iniciado.");
    }

    const applyUpdate = async () => {
      if (isOfflineEnvelope && input.baseRevision !== form.revision) {
        const currentSelections = await manager.getRepository(FaJudgeEntryDecision).find({
          where: {
            faJudgeFormId: form.id,
            decision: "SELECTED"
          },
          relations: {
            judgingParticipant: {
              fairEntry: true
            }
          },
          order: {
            selectionOrder: "ASC"
          }
        });
        assertExpectedRevision(input.baseRevision, form.revision, {
          aggregateId: form.id,
          currentState: {
            id: form.id,
            status: form.status,
            revision: form.revision,
            selectedParticipantIds: currentSelections.map(
              (selection) => selection.judgingParticipantId
            ),
            selectedTrackPositions: currentSelections.map(
              (selection) => selection.judgingParticipant.fairEntry.trackPosition
            )
          },
          resolution: "CAN_REAPPLY_LOCAL_DRAFT"
        });
      }

      const selectedParticipantIds = await validateFaSelection(
        manager,
        stage,
        payload.selectedParticipantIds
      );
      await replaceFaSelections(manager, form, selectedParticipantIds);
      await manager.getRepository(FaJudgeForm).increment({ id: form.id }, "revision", 1);
      form.revision += 1;
      const fa = await getFaForStage(manager, user, stage);
      return {
        responsePayload: fa,
        appliedRevision: form.revision
      };
    };

    if (!isOfflineEnvelope) {
      const applied = await applyUpdate();
      return { fa: applied.responsePayload };
    }

    const result = await executeIdempotentMutation(manager, {
      operationId: input.operationId,
      userId: user.id,
      stageId: stage.id,
      aggregateType: "FA_FORM",
      aggregateId: form.id,
      operationType: "UPDATE_FA_SELECTION",
      baseRevision: input.baseRevision,
      requestPayload: payload,
      apply: applyUpdate
    });

    return {
      fa: result.responsePayload,
      sync: {
        operationId: input.operationId,
        applied: !result.duplicate,
        duplicate: result.duplicate,
        revision: result.appliedRevision ?? form.revision,
        serverUpdatedAt: new Date().toISOString()
      }
    };
  });
}

export async function listDisqualificationReasons() {
  const dataSource = await getDataSource();
  const reasons = await dataSource.getRepository(DisqualificationReason).find({
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

export async function disqualifyParticipant(
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
    if (stage.status !== "JUDGING_STARTED") {
      throw new BadRequestError("El FA no se puede editar porque el juzgamiento ya no esta activo.");
    }
    const form = await getJudgeFormOrCreate(manager, stage, user);

    if (form.status !== "STARTED") {
      throw new BadRequestError("Solo se puede descalificar con FA iniciado.");
    }

    const [participant, reason] = await Promise.all([
      manager.getRepository(JudgingParticipant).findOne({
        where: { id: judgingParticipantId, fairCategoryStageId: stage.id },
        relations: { fairEntry: true }
      }),
      manager.getRepository(DisqualificationReason).findOne({
        where: { id: reasonId, isActive: true }
      })
    ]);

    if (!participant) {
      throw new NotFoundError("No se encontro el participante de juzgamiento.");
    }

    if (!reason) {
      throw new NotFoundError("No se encontro el motivo de descalificacion.");
    }

    if (participant.status === "DISQUALIFIED") {
      throw new BadRequestError("El ejemplar ya está descalificado.");
    }

    participant.status = "DISQUALIFIED";
    participant.disqualifiedByJudgeFormId = form.id;
    participant.disqualifiedByUserId = user.id;
    participant.disqualificationReasonId = reason.id;
    participant.disqualifiedAt = new Date();
    await manager.getRepository(JudgingParticipant).save(participant);
    await manager.getRepository(FaJudgeEntryDecision).upsert(
      {
        faJudgeFormId: form.id,
        judgingParticipantId: participant.id,
        decision: "DISQUALIFIED",
        selectionOrder: null,
        disqualificationReasonId: reason.id
      },
      ["faJudgeFormId", "judgingParticipantId"]
    );
    await recordEvent(manager, {
      stageId: stage.id,
      userId: user.id,
      eventType: "JUDGING_PARTICIPANT_DISQUALIFIED",
      payload: { judgingParticipantId: participant.id, reasonId: reason.id }
    });
    const notification = stageNotificationContext(stage);
    const judgeName = formatStaffDisplayName(user);
    await queueRoleNotifications(manager, stage, "2", {
      type: "JUDGING_PARTICIPANT_DISQUALIFIED",
      title: `Ejemplar ${participant.fairEntry?.trackPosition ?? ""} descalificado - ${notification.titleSuffix}`.trim(),
      body: `${judgeName} descalificó el ejemplar. Motivo: ${reason.name}. Categoría: ${notification.detail}.`,
      payload: {
        ...notification.payload,
        judgingParticipantId: participant.id,
        reasonId: reason.id,
        disqualifiedByUserId: user.id,
        disqualifiedByName: judgeName
      }
    });

    return getFaForStage(manager, user, stage);
  });
}

export async function closeFa(
  user: User,
  stageId: string,
  input: { selectedParticipantIds: string[] }
) {
  assertUserRole(user, ["JUDGE"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["2"]);
    if (stage.status !== "JUDGING_STARTED") {
      throw new BadRequestError("El FA no se puede cerrar porque el juzgamiento ya no esta activo.");
    }
    const form = await getJudgeFormForUpdate(manager, stage, user);

    if (form.status !== "STARTED") {
      throw new BadRequestError("Solo se puede cerrar un FA iniciado.");
    }

    const selectedParticipantIds = await validateFaSelection(
      manager,
      stage,
      input.selectedParticipantIds
    );
    const selectedIds = new Set(selectedParticipantIds);
    const participants = await manager.getRepository(JudgingParticipant).find({
      where: { fairCategoryStageId: stage.id, status: "ELIGIBLE" }
    });

    // El cierre reemplaza cualquier autosave previo. El lock del formulario evita
    // que un PUT concurrente inserte una decisión entre este reemplazo y el cierre.
    await manager
      .getRepository(FaJudgeEntryDecision)
      .createQueryBuilder()
      .delete()
      .where("fa_judge_form_id = :formId", { formId: form.id })
      .andWhere("decision IN (:...decisions)", { decisions: ["SELECTED", "DISCARDED"] })
      .execute();
    await replaceFaSelections(manager, form, selectedParticipantIds);

    const discarded = participants
      .filter((participant) => !selectedIds.has(participant.id))
      .map((participant) =>
        manager.getRepository(FaJudgeEntryDecision).create({
          faJudgeFormId: form.id,
          judgingParticipantId: participant.id,
          decision: "DISCARDED",
          selectionOrder: null,
          disqualificationReasonId: null
        })
      );

    if (discarded.length > 0) {
      await manager.getRepository(FaJudgeEntryDecision).save(discarded);
    }

    if (!form.startedAt) {
      form.startedAt = stage.judgingStartedAt ?? new Date();
    }
    form.status = "CLOSED";
    form.closedAt = new Date();
    await manager.getRepository(FaJudgeForm).save(form);
    await recordEvent(manager, {
      stageId: stage.id,
      userId: user.id,
      eventType: "JUDGE_FA_CLOSED"
    });
    const notification = stageNotificationContext(stage);
    await queueRoleNotifications(manager, stage, "3", {
      type: "JUDGE_FA_CLOSED",
      title: `FA cerrado - ${notification.titleSuffix}`,
      body: `Un juez cerro su Formato FA para ${notification.detail}.`,
      payload: { ...notification.payload, judgeUserId: user.id }
    });

    return getFaForStage(manager, user, stage);
  });
}

export async function getManagement(user: User, stageId: string) {
  assertUserRole(user, ["JUDGE", "TECHNICAL_DIRECTOR"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage);
    if (user.role === "JUDGE" && !stage.faConsolidatedAt) {
      throw new ForbiddenError(
        "Las selecciones de los jueces estarán disponibles después de consolidar el FA."
      );
    }
    const management = await getManagementForStage(manager, stage);
    if (user.role === "JUDGE") {
      return {
        ...management,
        veterinaryChecks: [],
        participants: [],
        faRepeatTrackRequests: []
      };
    }
    return management;
  });
}

async function getManagementForStage(manager: EntityManager, stage: FairCategoryStage) {
  const [summary, checks, forms, participants, consolidated, decisions, repeatTrackRequests] = await Promise.all([
      buildStageSummary(manager, stage),
      manager.getRepository(VeterinaryCheck).find({
        where: { fairCategoryStageId: stage.id },
        relations: { fairEntry: { horse: true } }
      }),
      manager.getRepository(FaJudgeForm).find({
        where: { fairCategoryStageId: stage.id },
        relations: { judgeUser: { person: true } }
      }),
      manager.getRepository(JudgingParticipant).find({
        where: { fairCategoryStageId: stage.id },
        relations: { fairEntry: true, disqualificationReason: true, disqualifiedByUser: { person: true } }
      }),
      manager.getRepository(FaConsolidatedResult).find({
        where: { fairCategoryStageId: stage.id },
        relations: { judgingParticipant: { fairEntry: true } },
        order: { finalPosition: "ASC" }
      }),
      manager.getRepository(FaJudgeEntryDecision).find({
        where: { faJudgeForm: { fairCategoryStageId: stage.id } },
        relations: { judgingParticipant: { fairEntry: true } }
      }),
      manager.getRepository(FaRepeatTrackRequest).find({
        where: { fairCategoryStageId: stage.id },
        relations: {
          faJudgeForm: { judgeUser: { person: true } },
          judgingParticipant: { fairEntry: true },
          executedByUser: { person: true }
        },
        order: { createdAt: "DESC" }
      })
  ]);

  return {
      summary: {
        ...summary,
        preRingClosedAt: stage.preRingClosedAt?.toISOString() ?? null,
        judgingStartedAt: stage.judgingStartedAt?.toISOString() ?? null
      },
      veterinaryChecks: checks.map((check) => ({
        id: check.id,
        revision: check.revision,
        trackPosition: check.fairEntry.trackPosition,
        horseName: check.fairEntry.horse?.name?.trim() || "",
        riderName: check.fairEntry.riderName,
        registrationNumber: check.fairEntry.registrationNumber,
        status: check.status
      })),
      judgeForms: forms.map((form) => {
        const formDecisions = decisions.filter((d) => d.faJudgeFormId === form.id);
        const selections = formDecisions
          .filter((d) => d.decision === "SELECTED")
          .sort((a, b) => (a.selectionOrder ?? 0) - (b.selectionOrder ?? 0))
          .map((d) => d.judgingParticipant.fairEntry.trackPosition);
        return {
          id: form.id,
          revision: form.revision,
          judgeUserId: form.judgeUserId,
          judgeName: form.judgeUser.person
            ? `${form.judgeUser.person.name} ${form.judgeUser.person.lastName}`.trim()
            : ROLE_LABELS.JUDGE,
          status: form.status,
          startedAt: form.startedAt?.toISOString() ?? null,
          closedAt: form.closedAt?.toISOString() ?? null,
          selectedCount: formDecisions.filter((d) => d.decision === "SELECTED").length,
          disqualifiedCount: formDecisions.filter((d) => d.decision === "DISQUALIFIED").length,
          selections
        };
      }),
      participants: participants.map((participant) => {
        const disqualifiedBy =
          toDisqualifiedByDto(participant.disqualifiedByUser) ??
          toDisqualifiedByDto(
            participant.disqualifiedByJudgeFormId
              ? forms.find((faForm) => faForm.id === participant.disqualifiedByJudgeFormId)?.judgeUser
              : null
          );

        return {
          id: participant.id,
          trackPosition: participant.fairEntry.trackPosition,
          riderName: participant.fairEntry.riderName,
          registrationNumber: participant.fairEntry.registrationNumber,
          status: participant.status,
          disqualificationReason: participant.disqualificationReason?.name ?? null,
          disqualifiedBy
        };
      }),
      faRepeatTrackRequests: repeatTrackRequests.map((request) => ({
        id: request.id,
        status: request.status,
        requestedAt: request.requestedAt.toISOString(),
        executedAt: request.executedAt?.toISOString() ?? null,
        judgeUserId: request.faJudgeForm.judgeUserId,
        judgeName: formatStaffDisplayName(request.faJudgeForm.judgeUser),
        executedBy: toDisqualifiedByDto(request.executedByUser),
        participant: {
          id: request.judgingParticipantId,
          trackPosition: request.judgingParticipant.fairEntry.trackPosition,
          riderName: request.judgingParticipant.fairEntry.riderName,
          registrationNumber: request.judgingParticipant.fairEntry.registrationNumber
        }
      })),
      consolidated: consolidated.map((result) => ({
        id: result.id,
        trackPosition: result.judgingParticipant.fairEntry.trackPosition,
        votesCount: result.votesCount,
        finalPosition: result.finalPosition
      }))
  };
}

export async function consolidateFa(user: User, stageId: string): Promise<StagedCategoryDto> {
  assertUserRole(user, ["TECHNICAL_DIRECTOR"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["3"]);

    if (stage.status !== "JUDGING_STARTED") {
      throw new BadRequestError("Solo se puede consolidar con juzgamiento iniciado.");
    }

    const judges = await getUsersByFairRole(manager, stage.fairId, "2");
    const forms = await manager.getRepository(FaJudgeForm).find({
      where: { fairCategoryStageId: stage.id }
    });
    const closedJudgeIds = new Set(forms.filter((form) => form.status === "CLOSED").map((form) => form.judgeUserId));

    if (judges.length === 0 || judges.some((judge) => !closedJudgeIds.has(judge.id))) {
      throw new BadRequestError("Todos los jueces de la feria deben cerrar su FA antes de consolidar.");
    }

    const rows = await manager
      .getRepository(FaJudgeEntryDecision)
      .createQueryBuilder("decision")
      .innerJoin("decision.judgingParticipant", "participant")
      .select("participant.id", "participantId")
      .addSelect("COUNT(decision.id)", "votesCount")
      .where("participant.fair_category_stage_id = :stageId", { stageId: stage.id })
      .andWhere("participant.status = :participantStatus", { participantStatus: "ELIGIBLE" })
      .andWhere("decision.decision = :decision", { decision: "SELECTED" })
      .groupBy("participant.id")
      .orderBy("COUNT(decision.id)", "DESC")
      .getRawMany<{ participantId: string; votesCount: string }>();

    await manager.getRepository(FaConsolidatedResult).delete({ fairCategoryStageId: stage.id });
    await manager.getRepository(FaConsolidatedResult).save(
      rows.map((row, index) =>
        manager.getRepository(FaConsolidatedResult).create({
          fairCategoryStageId: stage.id,
          judgingParticipantId: row.participantId,
          votesCount: Number(row.votesCount),
          finalPosition: index + 1
        })
      )
    );

    const previousStatus = stage.status;
    const survivors = rows.length;
    const now = new Date();
    if (survivors === 0) {
      stage.status = "JUDGING_DESERTED";
      stage.desertedAt = now;
      stage.desertedByUserId = user.id;
      stage.desertedReason = "Ningún ejemplar alcanzó selección en el Formato FA.";
    } else {
      // FA es solo la selección inicial: NO cierra el juzgamiento. A partir de aquí el
      // Director Técnico abre la siguiente ronda reglamentaria (F1 si hay más de 8
      // sobrevivientes, F2 en caso contrario). Ver `judging/round.service.ts`.
      stage.status = "FA_CONSOLIDATED";
      stage.faConsolidatedAt = now;
      stage.faConsolidatedByUserId = user.id;
    }
    await manager.getRepository(FairCategoryStage).save(stage);
    await recordEvent(manager, {
      stageId: stage.id,
      userId: user.id,
      eventType: survivors === 0 ? "COMPETITION_DESERTED" : "FA_CONSOLIDATED",
      fromStatus: previousStatus,
      toStatus: stage.status,
      payload: survivors === 0 ? { reason: stage.desertedReason } : undefined
    });
    const notification = stageNotificationContext(stage);
    if (survivors === 0) {
      await queueRoleNotifications(manager, stage, "2", {
        type: "COMPETITION_DESERTED",
        title: `Competencia desierta - ${notification.titleSuffix}`,
        body: `La categoría ${notification.detail} fue declarada desierta tras consolidar FA.`,
        payload: notification.payload
      });
    } else {
      const nextRound = survivors > 8 ? "F1 (cabeza de lote)" : "F2 (tarjeta final)";
      await queueRoleNotifications(manager, stage, "2", {
        type: "FA_CONSOLIDATED",
        title: `FA consolidado - ${notification.titleSuffix}`,
        body: `El Formato FA de ${notification.detail} fue consolidado (${survivors} ejemplares). Sigue ${nextRound}.`,
        payload: notification.payload
      });
    }

    return buildStageSummary(manager, await getStageOrThrow(manager, stage.id));
  });
}

export async function resetStageForTesting(user: User, stageId: string): Promise<StagedCategoryDto> {
  assertUserRole(user, ["TECHNICAL_DIRECTOR"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["3"]);

    await manager.getRepository(NotificationOutbox).delete({ fairCategoryStageId: stage.id });
    await manager.getRepository(WorkflowEvent).delete({ fairCategoryStageId: stage.id });
    await manager.getRepository(FaRepeatTrackRequest).delete({ fairCategoryStageId: stage.id });
    // Las rondas (F1/F2/desempate) cascadean a formularios, entradas, resultados y pruebas.
    await manager.getRepository(JudgingRound).delete({ fairCategoryStageId: stage.id });
    await manager.getRepository(FaConsolidatedResult).delete({ fairCategoryStageId: stage.id });
    await manager
      .getRepository(FaJudgeEntryDecision)
      .createQueryBuilder()
      .delete()
      .where(
        `fa_judge_form_id IN (SELECT id FROM fa_judge_forms WHERE fair_category_stage_id = :stageId)`,
        { stageId: stage.id }
      )
      .orWhere(
        `judging_participant_id IN (SELECT id FROM judging_participants WHERE fair_category_stage_id = :stageId)`,
        { stageId: stage.id }
      )
      .execute();
    await manager.getRepository(FaJudgeForm).delete({ fairCategoryStageId: stage.id });
    await manager.getRepository(JudgingParticipant).delete({ fairCategoryStageId: stage.id });
    await manager.getRepository(VeterinaryCheck).delete({ fairCategoryStageId: stage.id });

    stage.status = "NOT_STARTED";
    stage.preRingStartedAt = null;
    stage.preRingStartedByUserId = null;
    stage.preRingClosedAt = null;
    stage.preRingClosedByUserId = null;
    stage.judgingStartedAt = null;
    stage.judgingStartedByUserId = null;
    stage.faConsolidatedAt = null;
    stage.faConsolidatedByUserId = null;
    stage.judgingClosedAt = null;
    stage.judgingClosedByUserId = null;
    stage.desertedAt = null;
    stage.desertedByUserId = null;
    stage.desertedReason = null;
    await manager.getRepository(FairCategoryStage).save(stage);

    return buildStageSummary(manager, await getStageOrThrow(manager, stage.id));
  });
}
