import {
  JudgingReminder,
  JudgingRoundEntry,
  JudgingRoundEntryReminder,
  JudgingRoundEntryReminderHistory,
  JudgingRoundForm,
  JudgingParticipant,
  getDataSource,
  JudgingRound,
  type FairCategoryStage,
  type RoundEntryReminderEffect,
  type User
} from "@pegasus/core";
import type { EntityManager } from "typeorm";
import {
  BadRequestError,
  FormClosedError,
  NotFoundError
} from "../../lib/errors.js";
import type { MutationSyncMeta } from "../../lib/http.js";
import {
  assertExpectedRevision,
  executeIdempotentMutation
} from "../offline-idempotency.service.js";
import { assertStageAccess, assertUserRole, getStageOrThrow } from "./shared.js";
import { assertRoundMutationIdentity, resolveRoundTieBlockIdentity } from "./round-identity.js";

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

export type AvailableReminderDto = {
  id: string;
  name: string;
  icon: string;
};

export type EntryReminderDto = {
  reminderId: string;
  name: string;
  icon: string;
  effect: RoundEntryReminderEffect;
};

export type ReminderHistoryItemDto = {
  id: string;
  participantId: string;
  trackPosition: number;
  riderName: string;
  reminderId: string;
  reminderName: string;
  reminderIcon: string;
  effect: RoundEntryReminderEffect;
  createdAt: string;
};

async function getJudgeFormForRound(
  manager: EntityManager,
  roundId: string,
  judgeUserId: string
): Promise<JudgingRoundForm> {
  const form = await manager.getRepository(JudgingRoundForm).findOne({
    where: { roundId, judgeUserId }
  });

  if (!form) {
    throw new NotFoundError("No tienes un formulario asignado en esta ronda.");
  }

  return form;
}

async function getEditableEntryOrThrow(
  manager: EntityManager,
  form: JudgingRoundForm,
  participantId: string,
  options: { offline?: boolean } = {}
): Promise<JudgingRoundEntry> {
  if (form.status !== "STARTED") {
    if (options.offline) {
      throw new FormClosedError(form.id);
    }
    throw new BadRequestError("Solo puedes editar anotaciones en un formulario iniciado.");
  }

  const entry = await manager.getRepository(JudgingRoundEntry).findOne({
    where: { roundFormId: form.id, judgingParticipantId: participantId }
  });

  if (!entry) {
    throw new BadRequestError("El ejemplar no pertenece a tu tarjeta.");
  }

  return entry;
}

async function loadParticipantSnapshot(
  manager: EntityManager,
  participantId: string
): Promise<{ trackPosition: number; riderName: string }> {
  const participant = await manager.getRepository(JudgingParticipant).findOne({
    where: { id: participantId },
    relations: { fairEntry: true }
  });

  if (!participant) {
    throw new NotFoundError("No se encontró el participante.");
  }

  return {
    trackPosition: participant.fairEntry.trackPosition,
    riderName: participant.fairEntry.riderName
  };
}

export async function loadActiveReminders(manager: EntityManager): Promise<AvailableReminderDto[]> {
  const rows = await manager.getRepository(JudgingReminder).find({
    where: { isActive: true },
    order: { name: "ASC" }
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon
  }));
}

export async function loadRemindersByEntryIds(
  manager: EntityManager,
  entryIds: string[]
): Promise<Map<string, EntryReminderDto[]>> {
  if (entryIds.length === 0) {
    return new Map();
  }

  const rows = await manager.getRepository(JudgingRoundEntryReminder).find({
    where: entryIds.map((roundFormEntryId) => ({ roundFormEntryId })),
    relations: { judgingReminder: true }
  });

  const byEntryId = new Map<string, EntryReminderDto[]>();

  for (const row of rows) {
    const list = byEntryId.get(row.roundFormEntryId) ?? [];
    list.push({
      reminderId: row.judgingReminderId,
      name: row.judgingReminder.name,
      icon: row.judgingReminder.icon,
      effect: row.effect
    });
    byEntryId.set(row.roundFormEntryId, list);
  }

  return byEntryId;
}

export async function loadReminderHistory(
  manager: EntityManager,
  roundFormId: string
): Promise<ReminderHistoryItemDto[]> {
  const rows = await manager.getRepository(JudgingRoundEntryReminderHistory).find({
    where: { roundFormId },
    relations: { roundFormEntry: true },
    order: { createdAt: "DESC" },
    take: 100
  });

  const participantIds = [...new Set(rows.map((row) => row.roundFormEntry.judgingParticipantId))];
  const snapshots = new Map<string, { trackPosition: number; riderName: string }>();

  if (participantIds.length > 0) {
    const participants = await manager.getRepository(JudgingParticipant).find({
      where: participantIds.map((id) => ({ id })),
      relations: { fairEntry: true }
    });

    for (const participant of participants) {
      snapshots.set(participant.id, {
        trackPosition: participant.fairEntry.trackPosition,
        riderName: participant.fairEntry.riderName
      });
    }
  }

  return rows.map((row) => {
    const participantId = row.roundFormEntry.judgingParticipantId;
    const snapshot = snapshots.get(participantId);

    return {
      id: row.id,
      participantId,
      trackPosition: row.trackPositionSnapshot ?? snapshot?.trackPosition ?? 0,
      riderName: row.riderNameSnapshot ?? snapshot?.riderName ?? "",
      reminderId: row.judgingReminderId,
      reminderName: row.reminderNameSnapshot,
      reminderIcon: row.reminderIconSnapshot,
      effect: row.effect,
      createdAt: row.createdAt.toISOString()
    };
  });
}

type RemindersPayload = {
  reminders: Array<{ reminderId: string; effect: RoundEntryReminderEffect }>;
  roundId?: string;
  tieBlockIdentity?: string;
};

type RemindersOfflineEnvelope = {
  operationId: string;
  baseRevision: number;
  clientUpdatedAt: string;
  payload: RemindersPayload & {
    roundId: string;
    tieBlockIdentity: string;
  };
};

type NotePayload = {
  note?: string | null;
  roundId?: string;
  tieBlockIdentity?: string;
};

type NoteOfflineEnvelope = {
  operationId: string;
  baseRevision: number;
  clientUpdatedAt: string;
  payload: NotePayload & {
    roundId: string;
    tieBlockIdentity: string;
  };
};

export async function updateEntryReminders(
  user: User,
  stageId: string,
  participantId: string,
  input: RemindersPayload | RemindersOfflineEnvelope
): Promise<{ sync?: MutationSyncMeta }> {
  assertUserRole(user, ["JUDGE"]);
  const isOfflineEnvelope = "operationId" in input && "payload" in input;
  const payload = isOfflineEnvelope ? input.payload : input;
  const reminders = payload.reminders;

  const uniqueReminderIds = new Set(reminders.map((r) => r.reminderId));
  if (uniqueReminderIds.size !== reminders.length) {
    throw new BadRequestError("No puedes repetir el mismo recordatorio en un ejemplar.");
  }

  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["2"]);
    const round = await getActiveRoundOrThrow(manager, stage.id);

    const form = await getJudgeFormForRound(manager, round.id, user.id);
    const formEntries = await manager.getRepository(JudgingRoundEntry).find({
      where: { roundFormId: form.id },
      select: { judgingParticipantId: true }
    });
    const participantIds = formEntries.map((entry) => entry.judgingParticipantId);

    if (isOfflineEnvelope) {
      assertRoundMutationIdentity({
        stageId: stage.id,
        round,
        expectedRoundId: input.payload.roundId,
        expectedTieBlockIdentity: input.payload.tieBlockIdentity,
        participantIds
      });
    }

    const entry = await getEditableEntryOrThrow(manager, form, participantId, {
      offline: isOfflineEnvelope
    });

    const applyUpdate = async () => {
      if (isOfflineEnvelope) {
        assertExpectedRevision(input.baseRevision, form.revision, {
          aggregateId: entry.id,
          currentState: {
            formId: form.id,
            entryId: entry.id,
            revision: form.revision,
            roundId: round.id,
            tieBlockIdentity: resolveRoundTieBlockIdentity(round, participantIds)
          },
          resolution: "CAN_REAPPLY_LOCAL_DRAFT"
        });
      }

      const activeReminders = await manager.getRepository(JudgingReminder).find({
        where: { isActive: true }
      });
      const activeById = new Map(activeReminders.map((r) => [r.id, r]));

      for (const item of reminders) {
        const reminder = activeById.get(item.reminderId);
        if (!reminder) {
          throw new BadRequestError("Uno o más recordatorios no están activos o no existen.");
        }
      }

      const snapshot = await loadParticipantSnapshot(manager, participantId);
      const reminderRepo = manager.getRepository(JudgingRoundEntryReminder);
      const historyRepo = manager.getRepository(JudgingRoundEntryReminderHistory);

      await reminderRepo.delete({ roundFormEntryId: entry.id });

      if (reminders.length > 0) {
        const toSave = reminders.map((item) =>
          reminderRepo.create({
            roundFormEntryId: entry.id,
            judgingReminderId: item.reminderId,
            effect: item.effect
          })
        );
        await reminderRepo.save(toSave);

        await historyRepo.save(
          reminders.map((item) => {
            const reminder = activeById.get(item.reminderId)!;
            return historyRepo.create({
              roundFormId: form.id,
              roundFormEntryId: entry.id,
              judgingReminderId: item.reminderId,
              effect: item.effect,
              trackPositionSnapshot: snapshot.trackPosition,
              riderNameSnapshot: snapshot.riderName,
              reminderNameSnapshot: reminder.name,
              reminderIconSnapshot: reminder.icon
            });
          })
        );
      }

      await manager.getRepository(JudgingRoundForm).increment({ id: form.id }, "revision", 1);
      form.revision += 1;

      return {
        responsePayload: { ok: true as const },
        appliedRevision: form.revision
      };
    };

    if (!isOfflineEnvelope) {
      await applyUpdate();
      return {};
    }

    const result = await executeIdempotentMutation(manager, {
      operationId: input.operationId,
      userId: user.id,
      stageId: stage.id,
      aggregateType: "ROUND_REMINDERS",
      aggregateId: entry.id,
      operationType: "UPDATE_ROUND_REMINDERS",
      baseRevision: input.baseRevision,
      requestPayload: payload,
      apply: applyUpdate
    });

    return {
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

export async function updateEntryPrivateNote(
  user: User,
  stageId: string,
  participantId: string,
  input: NotePayload | NoteOfflineEnvelope
): Promise<{ sync?: MutationSyncMeta }> {
  assertUserRole(user, ["JUDGE"]);
  const isOfflineEnvelope = "operationId" in input && "payload" in input;
  const payload = isOfflineEnvelope ? input.payload : input;
  const note = payload.note ?? null;

  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["2"]);
    const round = await getActiveRoundOrThrow(manager, stage.id);

    const form = await getJudgeFormForRound(manager, round.id, user.id);
    const formEntries = await manager.getRepository(JudgingRoundEntry).find({
      where: { roundFormId: form.id },
      select: { judgingParticipantId: true }
    });
    const participantIds = formEntries.map((entry) => entry.judgingParticipantId);

    if (isOfflineEnvelope) {
      assertRoundMutationIdentity({
        stageId: stage.id,
        round,
        expectedRoundId: input.payload.roundId,
        expectedTieBlockIdentity: input.payload.tieBlockIdentity,
        participantIds
      });
    }

    const entry = await getEditableEntryOrThrow(manager, form, participantId, {
      offline: isOfflineEnvelope
    });

    const applyUpdate = async () => {
      if (isOfflineEnvelope) {
        assertExpectedRevision(input.baseRevision, form.revision, {
          aggregateId: entry.id,
          currentState: {
            formId: form.id,
            entryId: entry.id,
            revision: form.revision,
            privateNote: entry.privateNote,
            roundId: round.id,
            tieBlockIdentity: resolveRoundTieBlockIdentity(round, participantIds)
          },
          resolution: "CAN_REAPPLY_LOCAL_DRAFT"
        });
      }

      entry.privateNote = note?.trim() ? note.trim() : null;
      await manager.getRepository(JudgingRoundEntry).save(entry);
      await manager.getRepository(JudgingRoundForm).increment({ id: form.id }, "revision", 1);
      form.revision += 1;

      return {
        responsePayload: { ok: true as const },
        appliedRevision: form.revision
      };
    };

    if (!isOfflineEnvelope) {
      await applyUpdate();
      return {};
    }

    const result = await executeIdempotentMutation(manager, {
      operationId: input.operationId,
      userId: user.id,
      stageId: stage.id,
      aggregateType: "ROUND_NOTE",
      aggregateId: entry.id,
      operationType: "UPDATE_ROUND_NOTE",
      baseRevision: input.baseRevision,
      requestPayload: payload,
      apply: applyUpdate
    });

    return {
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

export async function getEntryReminderHistory(
  user: User,
  stageId: string
): Promise<ReminderHistoryItemDto[]> {
  assertUserRole(user, ["JUDGE"]);

  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["2"]);
    const round = await getActiveRoundOrThrow(manager, stage.id);

    const form = await getJudgeFormForRound(manager, round.id, user.id);
    return loadReminderHistory(manager, form.id);
  });
}
