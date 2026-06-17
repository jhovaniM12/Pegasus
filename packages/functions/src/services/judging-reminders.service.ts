import { JudgingReminder, getDataSource } from "@pegasus/core";
import type { Repository } from "typeorm";
import { BadRequestError, NotFoundError } from "../lib/errors.js";
import type { ReminderIconKey } from "../schemas/judging-reminders.schema.js";

export type JudgingReminderDto = {
  id: string;
  name: string;
  icon: ReminderIconKey;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function toDto(row: JudgingReminder): JudgingReminderDto {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon as ReminderIconKey,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

async function assertUniqueName(
  repository: Repository<JudgingReminder>,
  name: string,
  excludeId?: string
): Promise<void> {
  const qb = repository
    .createQueryBuilder("reminder")
    .where("LOWER(reminder.name) = LOWER(:name)", { name: name.trim() });

  if (excludeId) {
    qb.andWhere("reminder.id != :excludeId", { excludeId });
  }

  const existing = await qb.getOne();

  if (existing) {
    throw new BadRequestError("Ya existe un recordatorio con ese nombre.");
  }
}

export async function listJudgingReminders(filters?: {
  search?: string;
  isActive?: boolean;
}): Promise<JudgingReminderDto[]> {
  const dataSource = await getDataSource();
  const qb = dataSource
    .getRepository(JudgingReminder)
    .createQueryBuilder("reminder")
    .orderBy("reminder.name", "ASC");

  if (filters?.search) {
    qb.andWhere("LOWER(reminder.name) LIKE LOWER(:search)", {
      search: `%${filters.search.trim()}%`
    });
  }

  if (filters?.isActive !== undefined) {
    qb.andWhere("reminder.isActive = :isActive", { isActive: filters.isActive });
  }

  const rows = await qb.getMany();
  return rows.map(toDto);
}

export async function getJudgingReminderById(id: string): Promise<JudgingReminderDto> {
  const dataSource = await getDataSource();
  const row = await dataSource.getRepository(JudgingReminder).findOne({ where: { id } });

  if (!row) {
    throw new NotFoundError(`No se encontró el recordatorio con id "${id}".`);
  }

  return toDto(row);
}

export async function createJudgingReminder(input: {
  name: string;
  icon: ReminderIconKey;
  isActive?: boolean;
}): Promise<JudgingReminderDto> {
  const dataSource = await getDataSource();
  const repository = dataSource.getRepository(JudgingReminder);

  await assertUniqueName(repository, input.name);

  const row = repository.create({
    name: input.name.trim(),
    icon: input.icon,
    isActive: input.isActive ?? true
  });

  await repository.save(row);
  return toDto(row);
}

export async function updateJudgingReminder(
  id: string,
  input: { name?: string; icon?: ReminderIconKey; isActive?: boolean }
): Promise<JudgingReminderDto> {
  const dataSource = await getDataSource();
  const repository = dataSource.getRepository(JudgingReminder);
  const row = await repository.findOne({ where: { id } });

  if (!row) {
    throw new NotFoundError(`No se encontró el recordatorio con id "${id}".`);
  }

  if (input.name !== undefined) {
    await assertUniqueName(repository, input.name, id);
    row.name = input.name.trim();
  }

  if (input.icon !== undefined) row.icon = input.icon;
  if (input.isActive !== undefined) row.isActive = input.isActive;

  await repository.save(row);
  return toDto(row);
}

export async function deleteJudgingReminder(id: string): Promise<void> {
  const dataSource = await getDataSource();
  const repository = dataSource.getRepository(JudgingReminder);
  const row = await repository.findOne({ where: { id } });

  if (!row) {
    throw new NotFoundError(`No se encontró el recordatorio con id "${id}".`);
  }

  await repository.remove(row);
}
