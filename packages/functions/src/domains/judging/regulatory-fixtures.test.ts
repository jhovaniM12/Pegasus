import { describe, expect, it } from "vitest";
import { REGULATORY_FIXTURES } from "./regulatory-fixtures.js";
import { computeF2 } from "./scoring.js";

describe("fixtures reglamentarios canónicos", () => {
  it.each(REGULATORY_FIXTURES)("$id ($ruleId / $status)", (fixture) => {
    const result = computeF2(fixture.cards, fixture.judgeCount);

    if (fixture.expect.majorityWinnerId !== undefined) {
      expect(result.majorityWinnerId).toBe(fixture.expect.majorityWinnerId);
    }

    if (fixture.expect.positions) {
      for (const [participantId, position] of Object.entries(fixture.expect.positions)) {
        expect(
          result.participants.find((row) => row.participantId === participantId)?.finalPosition
        ).toBe(position);
      }
    }

    if (fixture.expect.hasBlockingTie !== undefined) {
      expect(result.hasBlockingTie).toBe(fixture.expect.hasBlockingTie);
    }

    if (fixture.expect.tieReasons) {
      const reasons = result.tiedGroups.map((group) => group.reason);
      for (const reason of fixture.expect.tieReasons) {
        expect(reasons).toContain(reason);
      }
      if (fixture.expect.tieReasons.length === 0) {
        expect(result.tiedGroups).toHaveLength(0);
      }
    }

    if (fixture.expect.fifthExceptionParticipants) {
      const fifth = result.tiedGroups.find((group) => group.reason === "FIFTH_PLACE_EXCEPTION_5E");
      expect(fifth).toBeDefined();
      expect([...fifth!.participantIds].sort()).toEqual(
        [...fixture.expect.fifthExceptionParticipants].sort()
      );
      // Quienes tienen 1º–4º no deben aparecer en el bloque 5.e.
      for (const participantId of fifth!.participantIds) {
        const position = result.participants.find((row) => row.participantId === participantId)
          ?.finalPosition;
        expect(position == null || position > 4).toBe(true);
      }
    }

    if (fixture.expect.desertedPositions) {
      expect(result.desertedResults.map((row) => row.finalPosition).sort()).toEqual(
        [...fixture.expect.desertedPositions].sort()
      );
    }

    if (fixture.expect.unawardedPositions) {
      // Compat: los puestos que antes eran UNAWARDED ahora viven en desertedResults.
      expect(result.desertedResults.map((row) => row.finalPosition).sort()).toEqual(
        expect.arrayContaining([...fixture.expect.unawardedPositions].sort())
      );
    }
  });
});
