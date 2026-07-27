import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OfficialResultBoard } from "./official-result-board";
import type { RoundResult } from "@/types/staged-flow";

function result(partial: Partial<RoundResult> & Pick<RoundResult, "id" | "participantId">): RoundResult {
  return {
    trackPosition: 1,
    riderName: "Jinete",
    registrationNumber: "REG",
    scoreValue: 10,
    firstPlaceVotes: 0,
    finalPosition: 3,
    status: "TIED",
    awardDistinctive: null,
    tieMembership: [],
    ...partial,
  };
}

describe("OfficialResultBoard - resultado oficial 1.º–5.º", () => {
  it("con forceOfficialStatus siempre muestra los 5 puestos y omite ejemplares fuera de cinta", () => {
    const markup = renderToStaticMarkup(
      <OfficialResultBoard
        forceOfficialStatus
        results={[
          result({
            id: "r1",
            participantId: "p1",
            trackPosition: 1,
            finalPosition: 1,
            status: "FINAL",
            awardDistinctive: { id: "d1", label: "Azul", colorHex: "#2563eb" },
          }),
          result({
            id: "r2",
            participantId: "p2",
            trackPosition: 8,
            finalPosition: 8,
            status: "FINAL",
            awardDistinctive: null,
          }),
        ]}
        desertedResults={[
          {
            id: "d5",
            finalPosition: 5,
            votesCount: 0,
            desertedVotes: 0,
            reason: "NO_ASSIGNMENTS",
            assignedVotes: 0,
            minimumRequired: 2,
            outcomeType: "DESERTED",
            awardDistinctive: { id: "d5", label: "Verde", colorHex: "#16a34a" },
          },
        ]}
      />
    );

    expect(markup).toContain("#1 · Jinete");
    expect(markup).not.toContain("#8");
    expect(markup).toContain("Puesto desierto");
    // Cinco celdas de puesto (1..5).
    expect(markup.match(/tabular-nums text-slate-700">\d+<\/span>/g)?.length).toBe(5);
  });
});

describe("OfficialResultBoard - badges reglamentarios", () => {
  it("distingue empate por suma de excepción 5.e y no marca empate por status solo", () => {
    const markup = renderToStaticMarkup(
      <OfficialResultBoard
        results={[
          result({
            id: "r1",
            participantId: "p1",
            trackPosition: 3,
            finalPosition: 3,
            scoreValue: 11,
            status: "TIED",
            tieMembership: [
              {
                reason: "SUM_EQUALITY",
                positionSum: 11,
                startPosition: 3,
                endPosition: 4,
                resolved: false,
              },
            ],
          }),
          result({
            id: "r2",
            participantId: "p2",
            trackPosition: 4,
            finalPosition: 5,
            scoreValue: 13,
            status: "TIED",
            tieMembership: [
              {
                reason: "FIFTH_PLACE_EXCEPTION_5E",
                positionSum: null,
                startPosition: 5,
                endPosition: 6,
                resolved: false,
              },
            ],
          }),
          result({
            id: "r3",
            participantId: "p3",
            trackPosition: 7,
            finalPosition: 7,
            scoreValue: 18,
            status: "TIED",
            tieMembership: [],
            awardDistinctive: null,
          }),
        ]}
      />
    );

    expect(markup).toContain("Empate");
    expect(markup).toContain("Desempate para definir quinto puesto (5.e)");
    expect(markup).toContain("Sin premio");
  });

  it("muestra resuelto por desempate en proyección provisional", () => {
    const markup = renderToStaticMarkup(
      <OfficialResultBoard
        results={[
          result({
            id: "r1",
            participantId: "p1",
            finalPosition: 5,
            status: "PROVISIONAL",
            resolvedByTieBreak: true,
            tieMembership: [
              {
                reason: "FIFTH_PLACE_EXCEPTION_5E",
                positionSum: null,
                startPosition: 5,
                endPosition: 6,
                resolved: true,
              },
            ],
          }),
        ]}
      />
    );

    expect(markup).toContain("Resuelto por desempate");
  });
});
