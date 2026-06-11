import type { Fair } from "@pegasus/core";
import { toCitySummaryDto, toGradeSummaryDto, type CitySummaryDto, type GradeSummaryDto } from "./catalog.mapper.js";
import { toSyncableDto, type SyncableDto } from "./syncable.mapper.js";

export type FairDto = SyncableDto & {
  name: string | null;
  year: number | null;
  startDate: string | null;
  endDate: string | null;
  comments: string | null;
  registeredCount: number | null;
  city: CitySummaryDto | null;
  grade: GradeSummaryDto | null;
};

export function toFairDto(fair: Fair): FairDto {
  return {
    ...toSyncableDto(fair),
    name: fair.name,
    year: fair.year,
    startDate: fair.startDate,
    endDate: fair.endDate,
    comments: fair.comments,
    registeredCount: fair.registeredCount,
    city: fair.city ? toCitySummaryDto(fair.city) : null,
    grade: fair.grade ? toGradeSummaryDto(fair.grade) : null
  };
}
