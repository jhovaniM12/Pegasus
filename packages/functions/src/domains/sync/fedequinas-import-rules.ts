import type { FairCategoryStageStatus, FairEntry } from "@pegasus/core";

export type ProtectedFairEntryFields = Pick<
  FairEntry,
  "categoryId" | "trackPosition" | "inscriptionNumber" | "registrationNumber"
>;

export function hasProtectedFairEntryChanges(
  current: ProtectedFairEntryFields,
  next: ProtectedFairEntryFields
): boolean {
  return (
    current.categoryId !== next.categoryId ||
    current.trackPosition !== next.trackPosition ||
    current.inscriptionNumber !== next.inscriptionNumber ||
    current.registrationNumber !== next.registrationNumber
  );
}

export function isImportIdentityLocked(status: FairCategoryStageStatus): boolean {
  switch (status) {
    case "NOT_STARTED":
      return false;
    case "PRE_RING_STARTED":
    case "PRE_RING_CLOSED":
    case "JUDGING_STARTED":
    case "FA_CONSOLIDATED":
    case "F1_IN_PROGRESS":
    case "F1_CONSOLIDATED":
    case "F2_IN_PROGRESS":
    case "TIE_BREAK_IN_PROGRESS":
    case "JUDGING_DESERTED":
    case "JUDGING_CLOSED":
      return true;
  }
}
