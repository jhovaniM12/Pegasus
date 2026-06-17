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
import { BadRequestError, NotFoundError } from "../../lib/errors.js";
import { assertStageAccess, assertUserRole, getStageOrThrow } from "./shared.js";

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
  participantId: string
): Promise<JudgingRoundEntry> {
  if (form.status !== "STARTED") {
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

export async function updateEntryReminders(
  user: User,
  stageId: string,
  participantId: string,
  reminders: Array<{ reminderId: string; effect: RoundEntryReminderEffect }>
): Promise<void> {
  assertUserRole(user, ["JUDGE"]);

  const uniqueReminderIds = new Set(reminders.map((r) => r.reminderId));
  if (uniqueReminderIds.size !== reminders.length) {
    throw new BadRequestError("No puedes repetir el mismo recordatorio en un ejemplar.");
  }

  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["2"]);
    const round = await getActiveRoundOrThrow(manager, stage.id);

    if (round.roundType !== "F1") {
      throw new BadRequestError("Los recordatorios solo están disponibles en F1.");
    }

    const form = await getJudgeFormForRound(manager, round.id, user.id);
    const entry = await getEditableEntryOrThrow(manager, form, participantId);

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
      const toSave = reminders.map((item) => {
        const reminder = activeById.get(item.reminderId)!;
        return reminderRepo.create({
          roundFormEntryId: entry.id,
          judgingReminderId: item.reminderId,
          effect: item.effect
        });
      });
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
  });
}

export async function updateEntryPrivateNote(
  user: User,
  stageId: string,
  participantId: string,
  note: string | null
): Promise<void> {
  assertUserRole(user, ["JUDGE"]);

  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const stage = await getStageOrThrow(manager, stageId);
    await assertStageAccess(manager, user, stage, ["2"]);
    const round = await getActiveRoundOrThrow(manager, stage.id);

    if (round.roundType !== "F1") {
      throw new BadRequestError("Las observaciones privadas solo están disponibles en F1.");
    }

    const form = await getJudgeFormForRound(manager, round.id, user.id);
    const entry = await getEditableEntryOrThrow(manager, form, participantId);

    entry.privateNote = note?.trim() ? note.trim() : null;
    await manager.getRepository(JudgingRoundEntry).save(entry);
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

    if (round.roundType !== "F1") {
      throw new BadRequestError("El historial de marcas solo está disponible en F1.");
    }

    const form = await getJudgeFormForRound(manager, round.id, user.id);
    return loadReminderHistory(manager, form.id);
  });
}
