import type { JudgeFormat, StagedCategory } from "@/types/staged-flow";

export type NextRoundFormat = JudgeFormat & { key: "F1" | "F2" };

export function resolveJudgeNextRoundFormat(
  summary: StagedCategory | null
): NextRoundFormat | null {
  if (!summary) return null;

  const formats = summary.judge?.formats ?? [];
  const availableFormat = formats.find(
    (format): format is NextRoundFormat =>
      (format.key === "F1" || format.key === "F2") &&
      format.isActive &&
      (format.formStatus === "PENDING" || format.formStatus === "STARTED")
  );
  if (availableFormat) return availableFormat;

  const expectedKey =
    summary.status === "F1_IN_PROGRESS"
      ? "F1"
      : summary.status === "F2_IN_PROGRESS"
        ? "F2"
        : null;
  if (!expectedKey) return null;

  // Si el backend ya informó el formato individual, su estado es definitivo.
  // En particular, CLOSED no debe convertirse nuevamente en PENDING.
  if (formats.some((format) => format.key === expectedKey)) return null;

  // Compatibilidad con respuestas antiguas que todavía no incluyen `judge.formats`.
  return {
    key: expectedKey,
    formStatus: "PENDING",
    isActive: true,
    participantCount: null,
  };
}
