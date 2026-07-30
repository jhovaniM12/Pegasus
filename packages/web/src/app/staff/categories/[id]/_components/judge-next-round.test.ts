import { describe, expect, it } from "vitest";

import type { StagedCategory } from "@/types/staged-flow";
import { resolveJudgeNextRoundFormat } from "./judge-next-round";

function summaryWith(
  status: StagedCategory["status"],
  formats: NonNullable<StagedCategory["judge"]>["formats"]
): StagedCategory {
  return {
    status,
    judge: {
      faFormStatus: "CLOSED",
      roundFormStatus: null,
      currentRoundType: null,
      seat: 3,
      label: "Juez 3",
      formats,
    },
  } as StagedCategory;
}

describe("resolveJudgeNextRoundFormat", () => {
  it("no vuelve a ofrecer P2 cuando la tarjeta del juez ya está cerrada", () => {
    const summary = summaryWith("F2_IN_PROGRESS", [
      {
        key: "F2",
        formStatus: "CLOSED",
        isActive: true,
        participantCount: 7,
      },
    ]);

    expect(resolveJudgeNextRoundFormat(summary)).toBeNull();
  });

  it("ofrece el formato individual pendiente o iniciado", () => {
    const summary = summaryWith("F2_IN_PROGRESS", [
      {
        key: "F2",
        formStatus: "STARTED",
        isActive: true,
        participantCount: 7,
      },
    ]);

    expect(resolveJudgeNextRoundFormat(summary)).toMatchObject({
      key: "F2",
      formStatus: "STARTED",
    });
  });

  it("conserva el fallback cuando la respuesta no incluye el formato esperado", () => {
    const summary = summaryWith("F2_IN_PROGRESS", []);

    expect(resolveJudgeNextRoundFormat(summary)).toMatchObject({
      key: "F2",
      formStatus: "PENDING",
    });
  });
});
