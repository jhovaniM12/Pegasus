import { AwardDistinctive, getDataSource } from "@pegasus/core";
import { NotFoundError } from "../lib/errors.js";

export type AwardDistinctiveDto = {
  id: string;
  position: number;
  label: string;
  colorName: string;
  colorHex: string | null;
  isActive: boolean;
};

function toDto(row: AwardDistinctive): AwardDistinctiveDto {
  return {
    id: row.id,
    position: row.position,
    label: row.label,
    colorName: row.colorName,
    colorHex: row.colorHex,
    isActive: row.isActive
  };
}

export async function listAwardDistinctives(): Promise<AwardDistinctiveDto[]> {
  const dataSource = await getDataSource();
  const rows = await dataSource.getRepository(AwardDistinctive).find({
    order: { position: "ASC" }
  });
  return rows.map(toDto);
}

export async function updateAwardDistinctive(
  id: string,
  input: { label?: string; colorName?: string; colorHex?: string | null; isActive?: boolean }
): Promise<AwardDistinctiveDto> {
  const dataSource = await getDataSource();
  const repository = dataSource.getRepository(AwardDistinctive);
  const row = await repository.findOne({ where: { id } });

  if (!row) {
    throw new NotFoundError(`No se encontró el distintivo con id "${id}".`);
  }

  if (input.label !== undefined) row.label = input.label;
  if (input.colorName !== undefined) row.colorName = input.colorName;
  if (input.colorHex !== undefined) row.colorHex = input.colorHex;
  if (input.isActive !== undefined) row.isActive = input.isActive;

  await repository.save(row);
  return toDto(row);
}
