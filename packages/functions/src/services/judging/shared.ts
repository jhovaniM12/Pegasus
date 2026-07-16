import {
  FairCategoryStage,
  FairStaff,
  NotificationOutbox,
  Role,
  User,
  WorkflowEvent,
  type UserRole
} from "@pegasus/core";
import type { EntityManager } from "typeorm";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";

/**
 * Helpers compartidos del flujo de juzgamiento (prepista, FA y rondas F1/F2/desempate).
 *
 * Se extrajeron de `staged-flow.service.ts` para evitar que ese archivo siga creciendo
 * como monolito y para que los servicios de rondas reutilicen acceso, eventos y
 * notificaciones sin duplicar lógica.
 */
export const ROLE_TO_EXTERNAL_ID: Partial<Record<UserRole, string>> = {
  JUDGE: "2",
  TECHNICAL_DIRECTOR: "3",
  VETERINARIAN: "Z"
};

export const ROLE_LABELS: Record<string, string> = {
  JUDGE: "Juez",
  TECHNICAL_DIRECTOR: "Director tecnico",
  VETERINARIAN: "Veterinario"
};

export type StaffRoleExternalId = "2" | "3" | "Z";

/** Tipos de evento auditados en `workflow_events`. */
export type WorkflowEventType =
  | "PRE_RING_STARTED"
  | "PRE_RING_CLOSED"
  | "JUDGING_STARTED"
  | "FA_STARTED"
  | "JUDGE_FA_CLOSED"
  | "JUDGING_PARTICIPANT_DISQUALIFIED"
  | "FA_CONSOLIDATED"
  | "ROUND_OPENED"
  | "ROUND_FORM_STARTED"
  | "ROUND_FORM_CLOSED"
  | "ROUND_CONSOLIDATED"
  | "TIE_DETECTED"
  | "TIE_BREAK_OPENED"
  | "TIE_BREAK_TEST_RECORDED"
  | "COMPETITION_DESERTED"
  | "JUDGING_CLOSED";

export function assertUserRole(user: User, roles: UserRole[]): void {
  if (!roles.includes(user.role)) {
    throw new ForbiddenError("El rol no puede ejecutar esta accion.");
  }
}

export function roleExternalIdForUser(user: User): string {
  const externalId = ROLE_TO_EXTERNAL_ID[user.role];

  if (!externalId) {
    throw new ForbiddenError("El rol no esta habilitado para este flujo.");
  }

  return externalId;
}

export async function getStageOrThrow(manager: EntityManager, stageId: string): Promise<FairCategoryStage> {
  const stage = await manager.getRepository(FairCategoryStage).findOne({
    where: { id: stageId },
    relations: { fair: true, category: { gait: true } }
  });

  if (!stage) {
    throw new NotFoundError(`No se encontro la etapa con id "${stageId}".`);
  }

  return stage;
}

export async function assertStaffInFair(
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

export async function assertStageAccess(
  manager: EntityManager,
  user: User,
  stage: FairCategoryStage,
  allowedRoleExternalIds?: StaffRoleExternalId[]
): Promise<void> {
  await assertStaffInFair(manager, user, stage.fairId, allowedRoleExternalIds);
}

export async function getUsersByFairRole(
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

export async function recordEvent(
  manager: EntityManager,
  input: {
    stageId: string;
    userId: string | null;
    eventType: WorkflowEventType;
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

export async function queueNotification(
  manager: EntityManager,
  input: {
    recipientUserId: string | null;
    recipientRole?: string | null;
    stageId: string;
    type: WorkflowEventType;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  const repo = manager.getRepository(NotificationOutbox);
  await repo.save(
    repo.create({
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

export async function queueRoleNotifications(
  manager: EntityManager,
  stage: FairCategoryStage,
  roleExternalId: StaffRoleExternalId,
  input: {
    type: WorkflowEventType;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  const users = await getUsersByFairRole(manager, stage.fairId, roleExternalId);
  const repo = manager.getRepository(NotificationOutbox);

  if (users.length === 0) {
    return;
  }

  await repo.save(
    users.map((recipient) =>
      repo.create({
        recipientUserId: recipient.id,
        recipientRole: recipient.role,
        fairCategoryStageId: stage.id,
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
    )
  );
}

export function stageNotificationContext(stage: FairCategoryStage) {
  const categoryName = stage.category.name ?? "Categoria sin nombre";
  const fairName = stage.fair.name ?? "Feria sin nombre";
  const gaitName = stage.category.gait?.name ?? "Sin andar";
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
