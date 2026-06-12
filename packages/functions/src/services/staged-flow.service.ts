import {
  Category,
  DisqualificationReason,
  FaConsolidatedResult,
  FaJudgeEntryDecision,
  FaJudgeForm,
  FairCategoryStage,
  FairEntry,
  FairStaff,
  getDataSource,
  JudgingParticipant,
  NotificationOutbox,
  Role,
  User,
  type FairCategoryStageStatus,
  type JudgeEntryDecision,
  type UserRole,
  type VeterinaryCheckStatus,
  VeterinaryCheck,
  WorkflowEvent
} from "@pegasus/core";
import type { DataSource, EntityManager } from "typeorm";
import { BadRequestError, ForbiddenError, NotFoundError } from "../lib/errors.js";

const ROLE_TO_EXTERNAL_ID: Partial<Record<UserRole, string>> = {
  JUDGE: "2",
  TECHNICAL_DIRECTOR: "3",
  VETERINARIAN: "Z"
};

const ROLE_LABELS: Record<string, string> = {
  JUDGE: "Juez",
  TECHNICAL_DIRECTOR: "Director tecnico",
  VETERINARIAN: "Veterinario"
};

type StageAction =
  | "PRE_RING_STARTED"
  | "PRE_RING_CLOSED"
  | "JUDGING_STARTED"
  | "FA_STARTED"
  | "JUDGE_FA_CLOSED"
  | "JUDGING_PARTICIPANT_DISQUALIFIED"
  | "FA_CONSOLIDATED"
  | "JUDGING_CLOSED";

type StaffRoleExternalId = "2" | "3" | "Z";

export type StagedCategoryDto = {
  stageId: string;
  status: FairCategoryStageStatus;
  fair: { id: string; name: string | null };
  category: { id: string; name: string | null; minAgeMonths: number; maxAgeMonths: number };
  gait: { id: string; name: string | null };
  totalEntries: number;
  veterinary: { pending: number; approved: number; rejected: number; absent: number };
  judging: { totalJudges: number; closedForms: number; selected: number; discarded: number; disqualified: number };
};

function assertUserRole(user: User, roles: UserRole[]): void {
  if (!roles.includes(user.role)) {
    throw new ForbiddenError("El rol no puede ejecutar esta accion.");
  }
}

function roleExternalIdForUser(user: User): string {
  const externalId = ROLE_TO_EXTERNAL_ID[user.role];

  if (!externalId) {
    throw new ForbiddenError("El rol no esta habilitado para este flujo.");
  }

  return externalId;
}

async function getStageOrThrow(manager: EntityManager, stageId: string): Promise<FairCategoryStage> {
  const stage = await manager.getRepository(FairCategoryStage).findOne({
    where: { id: stageId },
    relations: { fair: true, category: { gait: true } }
  });

  if (!stage) {
    throw new NotFoundError(`No se encontro la etapa con id "${stageId}".`);
  }

  return stage;
}

async function assertStaffInFair(
  manager: EntityManager,
  user: User,
  fairId: string,
  allowedRoleExternalIds?: StaffRoleExternalId[]
): Promise<void> {
  if (!user.personId) {
    throw new ForbiddenError("El usuario no esta asociado a una persona.");
  }

  const staff = await manager.getRepository(FairStaff).findOne({
    where: { personId: user.personId, fairId },
    relations: { role: true }
  });

  if (!staff?.role.externalId) {
    throw new ForbiddenError("El usuario no esta asignado como staff de esta feria.");
  }

  const expectedRole = roleExternalIdForUser(user);

  if (staff.role.externalId !== expectedRole) {
    throw new ForbiddenError("El rol del usuario no coincide con su asignacion de staff.");
  }

  if (allowedRoleExternalIds && !allowedRoleExternalIds.includes(staff.role.externalId as StaffRoleExternalId)) {
    throw new ForbiddenError("El rol no puede ejecutar esta accion.");
  }
}

async function assertStageAccess(
  manager: EntityManager,
  user: User,
  stage: FairCategoryStage,
  allowedRoleExternalIds?: StaffRoleExternalId[]
): Promise<void> {
  await assertStaffInFair(manager, user, stage.fairId, allowedRoleExternalIds);
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

async function getUsersByFairRole(
  manager: EntityManager,
  fairId: string,
  roleExternalId: StaffRoleExternalId
): Promise<User[]> {
  return manager
    .getRepository(User)
    .createQueryBuilder("user")
    .innerJoin(FairStaff, "staff", "staff.person_id = user.person_id")
    .innerJoin(Role, "role", "role.id = staff.role_id")
    .where("staff.fair_id = :fairId", { fairId })
    .andWhere("role.external_id = :roleExternalId", { roleExternalId })
    .andWhere("user.is_active = true")
    .getMany();
}

async function recordEvent(
  manager: EntityManager,
  input: {
    stageId: string;
    userId: string | null;
    eventType: StageAction;
    fromStatus?: string | null;
    toStatus?: string | null;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  await manager.getRepository(WorkflowEvent).save(
    manager.getRepository(WorkflowEvent).create({
      fairCategoryStageId: input.stageId,
      userId: input.userId,
      eventType: input.eventType,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      payload: input.payload ?? null
    })
  );
}

async function queueNotification(
  manager: EntityManager,
  input: {
    recipientUserId: string | null;
    recipientRole?: string | null;
    stageId: string;
    type: StageAction;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  await manager.getRepository(NotificationOutbox).save(
    manager.getRepository(NotificationOutbox).create({
      recipientUserId: input.recipientUserId,
      recipientRole: input.recipientRole ?? null,
      fairCategoryStageId: input.stageId,
      provider: "PUSHER_BEAMS",
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload ?? null,
      status: "PENDING",
      sentAt: null,
      failedAt: null,
      errorMessage: null
    })
  );
}

async function queueRoleNotifications(
  manager: EntityManager,
  stage: FairCategoryStage,
  roleExternalId: StaffRoleExternalId,
  input: {
    type: StageAction;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  const users = await getUsersByFairRole(manager, stage.fairId, roleExternalId);

  await Promise.all(
    users.map((recipient) =>
      queueNotification(manager, {
        recipientUserId: recipient.id,
        recipientRole: recipient.role,
        stageId: stage.id,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: input.payload
      })
    )
  );
}

function stageNotificationContext(stage: FairCategoryStage) {
  const categoryName = stage.category.name ?? "Categoria sin nombre";
  const fairName = stage.fair.name ?? "Feria sin nombre";
  const gaitName = stage.category.gait.name ?? "Sin andar";
  const titleSuffix = categoryName;
  const detail = `${categoryName} - ${gaitName} en ${fairName}`;

  return {
    categoryName,
    fairName,
    gaitName,
    titleSuffix,
    detail,
    payload: {
      stageId: stage.id,
      categoryName,
      fairName,
      gaitName,
      deepLink: `/staff/categories/${stage.id}`
    }
  };
}

async function getOrCreateStage(
  manager: EntityManager,
  fairId: string,
  categoryId: string
): Promise<FairCategoryStage> {
  let stage = await manager.getRepository(FairCategoryStage).findOne({
    where: { fairId, categoryId },
    relations: { fair: true, category: { gait: true } }
  });

  if (stage) {
    return stage;
  }

  stage = await manager.getRepository(FairCategoryStage).save(
    manager.getRepository(FairCategoryStage).create({
      fairId,
      categoryId,
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
      judgingClosedByUserId: null
    })
  );

  return getStageOrThrow(manager, stage.id);
}

async function buildStageSummary(manager: EntityManager, stage: FairCategoryStage): Promise<StagedCategoryDto> {
  const [totalEntries, checks, forms, decisions] = await Promise.all([
    manager.getRepository(FairEntry).count({
      where: { fairId: stage.fairId, categoryId: stage.categoryId }
    }),
    manager.getRepository(VeterinaryCheck).find({ where: { fairCategoryStageId: stage.id } }),
    manager.getRepository(FaJudgeForm).find({ where: { fairCategoryStageId: stage.id } }),
    manager.getRepository(FaJudgeEntryDecision).find({
      where: { faJudgeForm: { fairCategoryStageId: stage.id } },
      relations: { faJudgeForm: true }
    })
  ]);
  const judges = await getUsersByFairRole(manager, stage.fairId, "2");

  return {
    stageId: stage.id,
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
    totalEntries,
    veterinary: {
      pending: checks.filter((check) => check.status === "PENDING").length,
      approved: checks.filter((check) => check.status === "APPROVED").length,
      rejected: checks.filter((check) => check.status === "REJECTED").length,
      absent: checks.filter((check) => check.status === "ABSENT").length
    },
    judging: {
      totalJudges: judges.length,
      closedForms: forms.filter((form) => form.status === "CLOSED").length,
      selected: decisions.filter((decision) => decision.decision === "SELECTED").length,
      discarded: decisions.filter((decision) => decision.decision === "DISCARDED").length,
      disqualified: decisions.filter((decision) => decision.decision === "DISQUALIFIED").length
    }
  };
}

export async function listStagedCategories(user: User): Promise<StagedCategoryDto[]> {
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    if (!user.personId) {
      throw new ForbiddenError("El usuario no esta asociado a una persona.");
    }

    const roleExternalId = roleExternalIdForUser(user);
    const rows = await manager
      .getRepository(FairEntry)
      .createQueryBuilder("entry")
      .innerJoin("entry.fair", "fair")
      .innerJoin("entry.category", "category")
      .innerJoin("category.gait", "gait")
      .innerJoin(FairStaff, "staff", "staff.fair_id = entry.fair_id")
      .innerJoin(Role, "role", "role.id = staff.role_id")
      .select("fair.id", "fairId")
      .addSelect("category.id", "categoryId")
      .where("staff.person_id = :personId", { personId: user.personId })
      .andWhere("role.external_id = :roleExternalId", { roleExternalId })
      .groupBy("fair.id")
      .addGroupBy("category.id")
      .orderBy("fair.id", "ASC")
      .addOrderBy("category.id", "ASC")
      .getRawMany<{ fairId: string; categoryId: string }>();

    const stages = [];
    for (const row of rows) {
      stages.push(await getOrCreateStage(manager, row.fairId, row.categoryId));
    }

    return Promise.all(stages.map((stage) => buildStageSummary(manager, stage)));
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
    relations: { fairEntry: true },
    order: { fairEntry: { trackPosition: "ASC" } }
  });

  return checks.map((check) => ({
    id: check.id,
    fairEntryId: check.fairEntryId,
    trackPosition: check.fairEntry.trackPosition,
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
  input: { status: VeterinaryCheckStatus; notes?: string | null }
) {
  assertUserRole(user, ["VETERINARIAN"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["Z"]);

    if (stage.status !== "PRE_RING_STARTED") {
      throw new BadRequestError("El checkeo veterinario solo se puede editar con pre-pista iniciada.");
    }

    await ensureVeterinaryChecks(manager, stage);
    const check = await manager.getRepository(VeterinaryCheck).findOne({
      where: { fairCategoryStageId: stage.id, fairEntryId }
    });

    if (!check) {
      throw new NotFoundError("No se encontro el participante para checkeo veterinario.");
    }

    check.status = input.status;
    check.notes = input.notes ?? null;
    check.veterinarianUserId = user.id;
    check.checkedAt = input.status === "PENDING" ? null : new Date();
    await manager.getRepository(VeterinaryCheck).save(check);

    return listVeterinaryChecksForStage(manager, stage);
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

export async function startFa(user: User, stageId: string) {
  assertUserRole(user, ["JUDGE"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["2"]);

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
    return getFaForStage(manager, user, stage);
  });
}

async function getFaForStage(manager: EntityManager, user: User, stage: FairCategoryStage) {
  const form = await getJudgeFormOrCreate(manager, stage, user);
  const [participants, decisions, reasons] = await Promise.all([
    manager.getRepository(JudgingParticipant).find({
      where: { fairCategoryStageId: stage.id },
      relations: { fairEntry: true, disqualificationReason: true },
      order: { fairEntry: { trackPosition: "ASC" } }
    }),
    manager.getRepository(FaJudgeEntryDecision).find({
      where: { faJudgeFormId: form.id },
      relations: { disqualificationReason: true }
    }),
    manager.getRepository(DisqualificationReason).find({
      where: { isActive: true },
      order: { code: "ASC" }
    })
  ]);
  const decisionsByParticipantId = new Map(decisions.map((decision) => [decision.judgingParticipantId, decision]));

  return {
    stage: await buildStageSummary(manager, stage),
    form: {
      id: form.id,
      status: form.status,
      selectedCount: decisions.filter((decision) => decision.decision === "SELECTED").length,
      disqualifiedCount: decisions.filter((decision) => decision.decision === "DISQUALIFIED").length,
      discardedCount: decisions.filter((decision) => decision.decision === "DISCARDED").length,
      closedAt: form.closedAt?.toISOString() ?? null
    },
    participants: participants.map((participant) => {
      const decision = decisionsByParticipantId.get(participant.id);

      return {
        id: participant.id,
        fairEntryId: participant.fairEntryId,
        trackPosition: participant.fairEntry.trackPosition,
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

export async function updateFaDecisions(
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
      throw new BadRequestError("El FA no se puede editar porque el juzgamiento ya no esta activo.");
    }
    const form = await getJudgeFormOrCreate(manager, stage, user);

    if (form.status !== "STARTED") {
      throw new BadRequestError("Solo se puede editar un FA iniciado.");
    }

    if (input.selectedParticipantIds.length > 10) {
      throw new BadRequestError("Solo se pueden seleccionar maximo 10 participantes.");
    }

    const uniqueIds = Array.from(new Set(input.selectedParticipantIds));

    if (uniqueIds.length !== input.selectedParticipantIds.length) {
      throw new BadRequestError("La seleccion contiene participantes repetidos.");
    }

    const participants = await manager.getRepository(JudgingParticipant).findByIds(uniqueIds);

    if (participants.length !== uniqueIds.length) {
      throw new BadRequestError("La seleccion contiene participantes invalidos.");
    }

    if (participants.some((participant) => participant.fairCategoryStageId !== stage.id || participant.status !== "ELIGIBLE")) {
      throw new BadRequestError("Solo se pueden seleccionar participantes elegibles de esta categoria.");
    }

    await manager.getRepository(FaJudgeEntryDecision).delete({
      faJudgeFormId: form.id,
      decision: "SELECTED"
    });

    await manager.getRepository(FaJudgeEntryDecision).save(
      uniqueIds.map((participantId, index) =>
        manager.getRepository(FaJudgeEntryDecision).create({
          faJudgeFormId: form.id,
          judgingParticipantId: participantId,
          decision: "SELECTED",
          selectionOrder: index + 1,
          disqualificationReasonId: null
        })
      )
    );

    return getFaForStage(manager, user, stage);
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

    participant.status = "DISQUALIFIED";
    participant.disqualifiedByJudgeFormId = form.id;
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
    await queueRoleNotifications(manager, stage, "2", {
      type: "JUDGING_PARTICIPANT_DISQUALIFIED",
      title: `Ejemplar ${participant.fairEntry?.trackPosition ?? ""} descalificado - ${notification.titleSuffix}`.trim(),
      body: `Motivo: ${reason.name}. Categoria: ${notification.detail}.`,
      payload: { ...notification.payload, judgingParticipantId: participant.id, reasonId: reason.id }
    });

    return getFaForStage(manager, user, stage);
  });
}

export async function closeFa(user: User, stageId: string) {
  assertUserRole(user, ["JUDGE"]);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["2"]);
    if (stage.status !== "JUDGING_STARTED") {
      throw new BadRequestError("El FA no se puede cerrar porque el juzgamiento ya no esta activo.");
    }
    const form = await getJudgeFormOrCreate(manager, stage, user);

    if (form.status !== "STARTED") {
      throw new BadRequestError("Solo se puede cerrar un FA iniciado.");
    }

    const selectedCount = await manager.getRepository(FaJudgeEntryDecision).count({
      where: { faJudgeFormId: form.id, decision: "SELECTED" }
    });

    if (selectedCount < 1) {
      throw new BadRequestError("Debes seleccionar al menos un ejemplar antes de cerrar el FA.");
    }

    if (selectedCount > 10) {
      throw new BadRequestError("El FA excede el maximo de 10 seleccionados.");
    }

    const [participants, existingDecisions] = await Promise.all([
      manager.getRepository(JudgingParticipant).find({
        where: { fairCategoryStageId: stage.id, status: "ELIGIBLE" }
      }),
      manager.getRepository(FaJudgeEntryDecision).find({
        where: { faJudgeFormId: form.id }
      })
    ]);
    const decidedIds = new Set(existingDecisions.map((decision) => decision.judgingParticipantId));
    const discarded = participants
      .filter((participant) => !decidedIds.has(participant.id))
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
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage);
    const [summary, checks, forms, participants, consolidated, decisions] = await Promise.all([
      buildStageSummary(manager, stage),
      manager.getRepository(VeterinaryCheck).find({
        where: { fairCategoryStageId: stage.id },
        relations: { fairEntry: true }
      }),
      manager.getRepository(FaJudgeForm).find({
        where: { fairCategoryStageId: stage.id },
        relations: { judgeUser: { person: true } }
      }),
      manager.getRepository(JudgingParticipant).find({
        where: { fairCategoryStageId: stage.id },
        relations: { fairEntry: true, disqualificationReason: true }
      }),
      manager.getRepository(FaConsolidatedResult).find({
        where: { fairCategoryStageId: stage.id },
        relations: { judgingParticipant: { fairEntry: true } },
        order: { finalPosition: "ASC" }
      }),
      manager.getRepository(FaJudgeEntryDecision).find({
        where: { faJudgeForm: { fairCategoryStageId: stage.id } },
        relations: { judgingParticipant: { fairEntry: true } }
      })
    ]);

    return {
      summary: { ...summary, preRingClosedAt: stage.preRingClosedAt?.toISOString() ?? null },
      veterinaryChecks: checks.map((check) => ({
        id: check.id,
        trackPosition: check.fairEntry.trackPosition,
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
      participants: participants.map((participant) => ({
        id: participant.id,
        trackPosition: participant.fairEntry.trackPosition,
        riderName: participant.fairEntry.riderName,
        registrationNumber: participant.fairEntry.registrationNumber,
        status: participant.status,
        disqualificationReason: participant.disqualificationReason?.name ?? null
      })),
      consolidated: consolidated.map((result) => ({
        id: result.id,
        trackPosition: result.judgingParticipant.fairEntry.trackPosition,
        votesCount: result.votesCount,
        finalPosition: result.finalPosition
      }))
    };
  });
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
    stage.status = "JUDGING_CLOSED";
    stage.faConsolidatedAt = new Date();
    stage.faConsolidatedByUserId = user.id;
    stage.judgingClosedAt = stage.faConsolidatedAt;
    stage.judgingClosedByUserId = user.id;
    await manager.getRepository(FairCategoryStage).save(stage);
    await recordEvent(manager, {
      stageId: stage.id,
      userId: user.id,
      eventType: "FA_CONSOLIDATED",
      fromStatus: previousStatus,
      toStatus: "FA_CONSOLIDATED"
    });
    await recordEvent(manager, {
      stageId: stage.id,
      userId: user.id,
      eventType: "JUDGING_CLOSED",
      fromStatus: "FA_CONSOLIDATED",
      toStatus: stage.status
    });
    const notification = stageNotificationContext(stage);
    await queueRoleNotifications(manager, stage, "2", {
      type: "FA_CONSOLIDATED",
      title: `FA consolidado - ${notification.titleSuffix}`,
      body: `El Formato FA de ${notification.detail} fue consolidado y el juzgamiento quedo cerrado.`,
      payload: notification.payload
    });

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
    await manager.getRepository(FairCategoryStage).save(stage);

    return buildStageSummary(manager, await getStageOrThrow(manager, stage.id));
  });
}

export async function getPushNotificationTargets(dataSource: DataSource, notification: NotificationOutbox): Promise<string[]> {
  if (notification.recipientUserId) {
    return [notification.recipientUserId];
  }

  return dataSource
    .getRepository(User)
    .createQueryBuilder("user")
    .where("user.role = :role", { role: notification.recipientRole })
    .andWhere("user.is_active = true")
    .getMany()
    .then((users) => users.map((user) => user.id));
}
