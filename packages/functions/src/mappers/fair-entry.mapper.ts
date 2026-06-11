import type { FairEntry } from "@pegasus/core";
import { toCategoryDto, type CategoryDto } from "./category.mapper.js";
import { toSyncableDto, type SyncableDto } from "./syncable.mapper.js";

export type FairEntryDto = SyncableDto & {
  fairId: string;
  registrationNumber: string;
  trackPosition: number;
  riderName: string;
  riderDocumentNumber: string;
  receipt: string;
  participate: boolean;
  fairSequence: number;
  isChild: boolean;
  category: CategoryDto;
};

export function toFairEntryDto(entry: FairEntry): FairEntryDto {
  return {
    ...toSyncableDto(entry),
    fairId: entry.fairId,
    registrationNumber: entry.registrationNumber,
    trackPosition: entry.trackPosition,
    riderName: entry.riderName,
    riderDocumentNumber: entry.riderDocumentNumber,
    receipt: entry.receipt,
    participate: entry.participate,
    fairSequence: entry.fairSequence,
    isChild: entry.isChild,
    category: toCategoryDto(entry.category)
  };
}
