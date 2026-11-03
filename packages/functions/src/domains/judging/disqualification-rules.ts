import {
  JudgingDisqualificationReport,
  type DisqualificationReason
} from "@pegasus/core";
import type { EntityManager } from "typeorm";

export const HYPERFLEXION_REASON_CODE = "12";

export function requiredDisqualificationReports(
  reasonCode: string,
  judgeCount: number
): number {
  if (reasonCode !== HYPERFLEXION_REASON_CODE) return 1;
  if (judgeCount === 1) return 1;
  if (judgeCount === 3) return 2;
  if (judgeCount === 5) return 3;
  throw new Error(`Panel simultáneo no reglamentario: ${judgeCount} jueces.`);
}

export type RecordDisqualificationReportInput = {
  stageId: string;
  participantId: string;
  reason: Pick<DisqualificationReason, "id" | "code">;
  judgeUserId: string;
  judgeCount: number;
  faJudgeFormId?: string | null;
  roundId?: string | null;
  roundFormId?: string | null;
};

export type DisqualificationReportDecision = {
  reportCount: number;
  requiredReports: number;
  reachedThreshold: boolean;
  provisional: boolean;
};

export async function recordDisqualificationReport(
  manager: EntityManager,
  input: RecordDisqualificationReportInput
): Promise<DisqualificationReportDecision> {
  const repository = manager.getRepository(JudgingDisqualificationReport);
  await repository.upsert(
    {
      fairCategoryStageId: input.stageId,
      judgingParticipantId: input.participantId,
      disqualificationReasonId: input.reason.id,
      judgeUserId: input.judgeUserId,
      faJudgeFormId: input.faJudgeFormId ?? null,
      roundId: input.roundId ?? null,
      roundFormId: input.roundFormId ?? null,
      reportedAt: new Date()
    },
    ["judgingParticipantId", "disqualificationReasonId", "judgeUserId"]
  );

  const reportCount = await repository.count({
    where: {
      fairCategoryStageId: input.stageId,
      judgingParticipantId: input.participantId,
      disqualificationReasonId: input.reason.id
    }
  });
  const requiredReports = requiredDisqualificationReports(
    input.reason.code,
    input.judgeCount
  );
  const reachedThreshold = reportCount >= requiredReports;
  return {
    reportCount,
    requiredReports,
    reachedThreshold,
    provisional:
      input.reason.code === HYPERFLEXION_REASON_CODE && !reachedThreshold
  };
}
