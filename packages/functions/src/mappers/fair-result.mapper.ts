import type { FairResult } from "@pegasus/core";
import {
  toGradeSummaryDto,
  toTitleSummaryDto,
  type GradeSummaryDto,
  type CatalogSummaryDto
} from "./catalog.mapper.js";
import { toCategoryDto, type CategoryDto } from "./category.mapper.js";
import { toSyncableDto, type SyncableDto } from "./syncable.mapper.js";

export type FairEntrySummaryDto = SyncableDto & {
  registrationNumber: string;
  riderName: string;
  riderDocumentNumber: string;
};

export type FairResultDto = SyncableDto & {
  fairId: string;
  positionObtained: number;
  score: number;
  fairEntry: FairEntrySummaryDto;
  grade: GradeSummaryDto;
  category: CategoryDto;
  title: CatalogSummaryDto;
};

export function toFairResultDto(result: FairResult): FairResultDto {
  return {
    ...toSyncableDto(result),
    fairId: result.fairId,
    positionObtained: result.positionObtained,
    score: Number(result.score),
    fairEntry: {
      ...toSyncableDto(result.fairEntry),
      registrationNumber: result.fairEntry.registrationNumber,
      riderName: result.fairEntry.riderName,
      riderDocumentNumber: result.fairEntry.riderDocumentNumber
    },
    grade: toGradeSummaryDto(result.grade),
    category: toCategoryDto(result.category),
    title: toTitleSummaryDto(result.title)
  };
}
