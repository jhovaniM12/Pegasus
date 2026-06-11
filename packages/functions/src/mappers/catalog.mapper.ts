import type { City, EquineType, Gait, Grade, Grouping, Role, Sex, Title } from "@pegasus/core";
import { toSyncableDto, type SyncableDto } from "./syncable.mapper.js";

export type CatalogSummaryDto = SyncableDto & {
  name: string;
};

export type CitySummaryDto = SyncableDto & {
  name: string;
  departmentCode: string;
};

export type GradeSummaryDto = SyncableDto & {
  name: string;
  nomenclature: string;
};

export type GroupingSummaryDto = SyncableDto & {
  groupPermissionCode: string;
};

export type RoleSummaryDto = SyncableDto & {
  name: string;
  typeRole: string;
};

export function toCitySummaryDto(city: City): CitySummaryDto {
  return {
    ...toSyncableDto(city),
    name: city.name,
    departmentCode: city.departmentCode
  };
}

export function toGradeSummaryDto(grade: Grade): GradeSummaryDto {
  return {
    ...toSyncableDto(grade),
    name: grade.name,
    nomenclature: grade.nomenclature
  };
}

export function toSexSummaryDto(sex: Sex): CatalogSummaryDto {
  return { ...toSyncableDto(sex), name: sex.name };
}

export function toGaitSummaryDto(gait: Gait): CatalogSummaryDto {
  return { ...toSyncableDto(gait), name: gait.name };
}

export function toEquineTypeSummaryDto(equineType: EquineType): CatalogSummaryDto {
  return { ...toSyncableDto(equineType), name: equineType.name };
}

export function toGroupingSummaryDto(grouping: Grouping): GroupingSummaryDto {
  return {
    ...toSyncableDto(grouping),
    groupPermissionCode: grouping.groupPermissionCode
  };
}

export function toTitleSummaryDto(title: Title): CatalogSummaryDto {
  return { ...toSyncableDto(title), name: title.name };
}

export function toRoleSummaryDto(role: Role): RoleSummaryDto {
  return {
    ...toSyncableDto(role),
    name: role.name,
    typeRole: role.typeRole
  };
}
