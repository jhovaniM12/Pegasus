import type { TieBreakTestType } from "@pegasus/core";
import type { TieBreakReason } from "@pegasus/core";

export type TieBlockPriorityInput = {
  reason: TieBreakReason;
  startPosition: number;
};

/**
 * Decisión operativa Pegasus:
 * 1) empates ordinarios que afectan 1.º–4.º;
 * 2) excepción 5.e;
 * 3) otros empates ordinarios.
 * Las causas siempre conservan rondas separadas.
 */
export function tieBlockResolutionPriority(block: TieBlockPriorityInput): number {
  if (block.reason === "SUM_EQUALITY" && block.startPosition <= 4) return 0;
  if (block.reason === "FIFTH_PLACE_EXCEPTION_5E") return 1;
  return 2;
}

export function activeJudgeIndexes(input: {
  configuredJudgeCount: number;
  isGradeB: boolean;
  stageOrdinal: number;
}): number[] {
  const { configuredJudgeCount, isGradeB, stageOrdinal } = input;
  if (configuredJudgeCount === 1 || configuredJudgeCount === 3 || configuredJudgeCount === 5) {
    return Array.from({ length: configuredJudgeCount }, (_, index) => index);
  }
  if (configuredJudgeCount === 2 && isGradeB) {
    return [Math.abs(stageOrdinal) % 2];
  }
  throw new Error(
    configuredJudgeCount === 2
      ? "Dos jueces solo se permiten en Grado B alternada, con uno activo por categoría."
      : `Panel simultáneo no reglamentario: ${configuredJudgeCount} jueces.`
  );
}

/**
 * Art. 13: con 3 o más ejemplares empatados se excluyen Cambio de Dirección y Paralelo.
 */
export function assertTieBreakTestsAllowed(
  tiedParticipantCount: number,
  testTypes: TieBreakTestType[]
): { ok: true } | { ok: false; message: string } {
  if (tiedParticipantCount < 3) {
    return { ok: true };
  }
  const forbidden = testTypes.filter(
    (testType) => testType === "DIRECTION_CHANGE" || testType === "PARALLEL"
  );
  if (forbidden.length === 0) {
    return { ok: true };
  }
  return {
    ok: false,
    message:
      "Con tres o más ejemplares empatados no se pueden usar Cambio de dirección ni Paralelo."
  };
}

export function validateTieBreakOpening(input: {
  testType: TieBreakTestType;
  completedTestTypes: TieBreakTestType[];
  tiedParticipantCount: number;
}): { ok: true } | { ok: false; message: string } {
  const participantGuard = assertTieBreakTestsAllowed(input.tiedParticipantCount, [
    input.testType
  ]);
  if (!participantGuard.ok) return participantGuard;

  if (input.testType === "MOUNT") {
    const completed = new Set(input.completedTestTypes);
    const mandatory: TieBreakTestType[] = ["DOUBLE_TABLE", "CIRCLES"];
    if (input.tiedParticipantCount === 2) {
      mandatory.push("DIRECTION_CHANGE", "PARALLEL");
    }
    const locomotionCompleted = completed.has("STOP_AND_GO") || completed.has("GAIT_CHANGE");
    if (mandatory.some((type) => !completed.has(type)) || !locomotionCompleted) {
      return {
        ok: false,
        message:
          "Montar es el último recurso: deben agotarse las pruebas anteriores aplicables."
      };
    }
  }

  return { ok: true };
}
