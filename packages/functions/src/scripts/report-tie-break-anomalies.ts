import {
  AppDataSource,
  FairCategoryStage,
  JudgingRound,
  JudgingRoundEntry,
  JudgingRoundForm,
  JudgingRoundFormDesertedPosition,
  getDataSource,
  tieBlockKey,
  typedTieBlockKey
} from "@pegasus/core";
import { In } from "typeorm";
import { computeF2, type JudgeCard } from "../services/judging/scoring.js";

type ExpectedBlock = {
  reason: "SUM_EQUALITY" | "FIFTH_PLACE_EXCEPTION_5E";
  participantIds: string[];
  startPosition: number;
  endPosition: number;
};

type DiagnosticRow = {
  fairId: string;
  categoryId: string;
  stageId: string;
  f2RoundId: string;
  tieBreakRoundId: string;
  tieBreakStatus: string;
  recordedReason: string | null;
  currentParticipantIds: string[];
  expectedBlocks: ExpectedBlock[];
  causes: string[];
  suggestedAction: string;
};

async function loadCards(roundId: string): Promise<JudgeCard[]> {
  const dataSource = await getDataSource();
  const forms = await dataSource.getRepository(JudgingRoundForm).find({ where: { roundId } });
  if (forms.length === 0) return [];

  const formIds = forms.map((form) => form.id);
  const [entries, desertedRows] = await Promise.all([
    dataSource.getRepository(JudgingRoundEntry).find({
      where: { roundFormId: In(formIds) },
      relations: { judgingParticipant: true }
    }),
    dataSource.getRepository(JudgingRoundFormDesertedPosition).find({
      where: { roundFormId: In(formIds) }
    })
  ]);

  return forms.map((form) => {
    const eligibleEntries = entries.filter(
      (entry) =>
        entry.roundFormId === form.id && entry.judgingParticipant.status === "ELIGIBLE"
    );
    return {
      judgeUserId: form.judgeUserId,
      positions: eligibleEntries
        .filter((entry) => entry.position !== null)
        .map((entry) => ({
          participantId: entry.judgingParticipantId,
          position: entry.position as number
        })),
      desertedPositions: desertedRows
        .filter((row) => row.roundFormId === form.id)
        .map((row) => row.position),
      eligibleParticipantIds: eligibleEntries.map((entry) => entry.judgingParticipantId)
    };
  });
}

async function loadRoundParticipantIds(roundId: string): Promise<string[]> {
  const dataSource = await getDataSource();
  const forms = await dataSource.getRepository(JudgingRoundForm).find({ where: { roundId } });
  if (forms.length === 0) return [];
  const entries = await dataSource.getRepository(JudgingRoundEntry).find({
    where: { roundFormId: In(forms.map((form) => form.id)) }
  });
  return [...new Set(entries.map((entry) => entry.judgingParticipantId))].sort();
}

function expectedKey(block: ExpectedBlock): string {
  return typedTieBlockKey(block.reason, block.participantIds);
}

async function main(): Promise<void> {
  const dataSource = await getDataSource();
  const f2Rounds = await dataSource.getRepository(JudgingRound).find({
    where: { roundType: "F2" },
    order: { createdAt: "ASC" }
  });
  const diagnostics: DiagnosticRow[] = [];

  for (const f2 of f2Rounds) {
    if (f2.status === "OPEN") continue;
    const [stage, cards, tieBreakRounds] = await Promise.all([
      dataSource.getRepository(FairCategoryStage).findOneByOrFail({
        id: f2.fairCategoryStageId
      }),
      loadCards(f2.id),
      dataSource.getRepository(JudgingRound).find({
        where: {
          fairCategoryStageId: f2.fairCategoryStageId,
          roundType: "TIE_BREAK",
          parentRoundId: f2.id
        },
        order: { sequence: "ASC" }
      })
    ]);

    const expectedBlocks = computeF2(cards, cards.length).tiedGroups
      .filter((group) => group.blocksClosure)
      .map((group) => ({
        reason: group.reason,
        participantIds: [...group.participantIds].sort(),
        startPosition: group.startPosition,
        endPosition: group.endPosition
      }));
    const expectedTypedKeys = new Set(expectedBlocks.map(expectedKey));
    const expectedUntypedKeys = new Set(
      expectedBlocks.map((block) => tieBlockKey(block.participantIds))
    );

    for (const tieBreak of tieBreakRounds) {
      const participantIds = await loadRoundParticipantIds(tieBreak.id);
      const causes: string[] = [];
      if (!tieBreak.tieBreakReason) {
        causes.push("LEGACY_WITHOUT_EXPLICIT_REASON");
      } else if (
        !expectedTypedKeys.has(typedTieBlockKey(tieBreak.tieBreakReason, participantIds))
      ) {
        causes.push("UNEXPECTED_OR_MIXED_BLOCK");
      }
      if (!expectedUntypedKeys.has(tieBlockKey(participantIds))) {
        causes.push("PARTIAL_DUPLICATE_OR_CONSECUTIVE_TIED_GROUP");
      }

      if (causes.length === 0) continue;
      diagnostics.push({
        fairId: stage.fairId,
        categoryId: stage.categoryId,
        stageId: stage.id,
        f2RoundId: f2.id,
        tieBreakRoundId: tieBreak.id,
        tieBreakStatus: tieBreak.status,
        recordedReason: tieBreak.tieBreakReason,
        currentParticipantIds: participantIds,
        expectedBlocks,
        causes,
        suggestedAction:
          tieBreak.status === "OPEN"
            ? "Revisar funcionalmente; si no tiene acciones posteriores, invalidar y regenerar mediante un procedimiento autorizado."
            : "No modificar automáticamente. Requiere respaldo, revisión funcional y autorización explícita."
      });
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: "READ_ONLY",
        affectedRounds: diagnostics.length,
        diagnostics
      },
      null,
      2
    )}\n`
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });
