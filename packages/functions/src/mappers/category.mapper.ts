import type { Category } from "@pegasus/core";
import {
  toEquineTypeSummaryDto,
  toGaitSummaryDto,
  toGroupingSummaryDto,
  toSexSummaryDto,
  type CatalogSummaryDto,
  type GroupingSummaryDto
} from "./catalog.mapper.js";
import { toSyncableDto, type SyncableDto } from "./syncable.mapper.js";

export type CategoryDto = SyncableDto & {
  name: string;
  minAgeMonths: number;
  maxAgeMonths: number;
  nextCategoryCode: string | null;
  largeCamps: number;
  sex: CatalogSummaryDto;
  gait: CatalogSummaryDto;
  equineType: CatalogSummaryDto;
  grouping: GroupingSummaryDto;
};

export function toCategoryDto(category: Category): CategoryDto {
  return {
    ...toSyncableDto(category),
    name: category.name,
    minAgeMonths: Number(category.minAgeMonths),
    maxAgeMonths: Number(category.maxAgeMonths),
    nextCategoryCode: category.nextCategoryCode ?? null,
    largeCamps: category.largeCamps,
    sex: toSexSummaryDto(category.sex),
    gait: toGaitSummaryDto(category.gait),
    equineType: toEquineTypeSummaryDto(category.equineType),
    grouping: toGroupingSummaryDto(category.grouping)
  };
}
