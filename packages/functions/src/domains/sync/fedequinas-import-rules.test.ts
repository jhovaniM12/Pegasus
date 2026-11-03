import type { FairCategoryStageStatus } from "@pegasus/core";
import { describe, expect, it } from "vitest";
import {
  hasProtectedFairEntryChanges,
  isImportIdentityLocked,
  type ProtectedFairEntryFields
} from "./fedequinas-import-rules.js";

const STARTED_STATUSES: FairCategoryStageStatus[] = [
  "PRE_RING_STARTED",
  "PRE_RING_CLOSED",
  "JUDGING_STARTED",
  "FA_CONSOLIDATED",
  "F1_IN_PROGRESS",
  "F1_CONSOLIDATED",
  "F2_IN_PROGRESS",
  "TIE_BREAK_IN_PROGRESS",
  "JUDGING_DESERTED",
  "JUDGING_CLOSED"
];

describe("protección de importaciones iniciadas", () => {
  it("bloquea todos los estados desde PRE_RING_STARTED", () => {
    expect(isImportIdentityLocked("NOT_STARTED")).toBe(false);
    for (const status of STARTED_STATUSES) {
      expect(isImportIdentityLocked(status), status).toBe(true);
    }
  });

  it.each<keyof ProtectedFairEntryFields>([
    "categoryId",
    "trackPosition",
    "inscriptionNumber",
    "registrationNumber"
  ])("detecta cambios protegidos en %s", (field) => {
    const current: ProtectedFairEntryFields = {
      categoryId: "category-1",
      trackPosition: 1,
      inscriptionNumber: "100",
      registrationNumber: "200"
    };
    const next = {
      ...current,
      [field]: field === "trackPosition" ? 2 : `${String(current[field])}-changed`
    };

    expect(hasProtectedFairEntryChanges(current, next)).toBe(true);
  });

  it("no trata enriquecimiento como cambio protegido", () => {
    const protectedFields: ProtectedFairEntryFields = {
      categoryId: "category-1",
      trackPosition: 1,
      inscriptionNumber: "100",
      registrationNumber: "200"
    };
    const enrichedEntry = {
      ...protectedFields,
      horseId: "horse-id",
      riderName: "Nombre actualizado",
      riderDocumentNumber: "123",
      name: "Caballo",
      fatherName: "Padre",
      motherName: "Madre"
    };

    expect(hasProtectedFairEntryChanges(protectedFields, enrichedEntry)).toBe(false);
  });
});
