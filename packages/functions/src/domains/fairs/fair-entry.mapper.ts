import type { FairEntry } from "@pegasus/core";
import { toCategoryDto, type CategoryDto } from "../categories/category.mapper.js";
import { toSyncableDto, type SyncableDto } from "../../shared/syncable.mapper.js";

export type FairEntryDto = SyncableDto & {
  fairId: string;
  inscriptionNumber: string | null;
  registrationNumber: string;
  horseId: string | null;
  trackPosition: number;
  riderName: string;
  riderDocumentNumber: string | null;
  receipt: string | null;
  participate: boolean;
  isChild: boolean | null;
  category: CategoryDto;
};

export function toFairEntryDto(entry: FairEntry): FairEntryDto {
  return {
    ...toSyncableDto(entry),
    fairId: entry.fairId,
    inscriptionNumber: entry.inscriptionNumber,
    registrationNumber: entry.registrationNumber,
    horseId: entry.horseId,
    trackPosition: entry.trackPosition,
    riderName: entry.riderName,
    riderDocumentNumber: entry.riderDocumentNumber,
    receipt: entry.receipt,
    participate: entry.participate,
    isChild: entry.isChild,
    category: toCategoryDto(entry.category)
  };
}
