import { getDataSource, SystemSetting } from "@pegasus/core";
import type { EntityManager } from "typeorm";

export const F1_MAX_SELECTIONS_SETTING_KEY = "F1_MAX_SELECTIONS";
export const DEFAULT_F1_MAX_SELECTIONS = 10;
export const MIN_F1_MAX_SELECTIONS = 1;
export const MAX_F1_MAX_SELECTIONS = 50;

export type JudgingSystemSettingsDto = {
  f1MaxSelections: number;
};

export function normalizeF1MaxSelections(value: number | null | undefined): number {
  if (
    value === null ||
    value === undefined ||
    !Number.isInteger(value) ||
    value < MIN_F1_MAX_SELECTIONS ||
    value > MAX_F1_MAX_SELECTIONS
  ) {
    return DEFAULT_F1_MAX_SELECTIONS;
  }
  return value;
}

export async function getF1MaxSelections(manager: EntityManager): Promise<number> {
  const setting = await manager.getRepository(SystemSetting).findOne({
    where: { key: F1_MAX_SELECTIONS_SETTING_KEY }
  });
  return normalizeF1MaxSelections(setting?.integerValue);
}

export async function getJudgingSystemSettings(): Promise<JudgingSystemSettingsDto> {
  const dataSource = await getDataSource();
  return {
    f1MaxSelections: await getF1MaxSelections(dataSource.manager)
  };
}

export async function updateJudgingSystemSettings(input: {
  f1MaxSelections: number;
}): Promise<JudgingSystemSettingsDto> {
  const dataSource = await getDataSource();
  return dataSource.transaction(async (manager) => {
    const repository = manager.getRepository(SystemSetting);
    let setting = await repository.findOne({
      where: { key: F1_MAX_SELECTIONS_SETTING_KEY },
      lock: { mode: "pessimistic_write" }
    });

    if (!setting) {
      setting = repository.create({ key: F1_MAX_SELECTIONS_SETTING_KEY });
    }
    setting.integerValue = input.f1MaxSelections;
    await repository.save(setting);

    return { f1MaxSelections: setting.integerValue };
  });
}
