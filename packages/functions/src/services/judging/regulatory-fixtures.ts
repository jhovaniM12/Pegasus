import type { JudgeCard } from "./scoring.js";

/**
 * Fixtures canónicos del contrato reglamentario Art. 15 / notas 4–5.
 * Cada fixture referencia un ID de `docs/MATRIZ_REGLAMENTARIA_JUZGAMIENTO.md`.
 */
export type RegulatoryFixture = {
  id: string;
  ruleId: string;
  status: "CONFIRMADA" | "DECISIÓN_OPERATIVA" | "EXCEPCIÓN_CONOCIDA";
  judgeCount: number;
  cards: JudgeCard[];
  expect: {
    majorityWinnerId?: string | null;
    positions?: Record<string, number>;
    hasBlockingTie?: boolean;
    tieReasons?: Array<"SUM_EQUALITY" | "FIFTH_PLACE_EXCEPTION_5E">;
    fifthExceptionParticipants?: string[];
    desertedPositions?: number[];
    unawardedPositions?: number[];
  };
};

function card(
  judgeUserId: string,
  orderedParticipantIds: string[],
  extraEligible: string[] = [],
  desertedPositions: number[] = []
): JudgeCard {
  return {
    judgeUserId,
    positions: orderedParticipantIds.map((participantId, index) => ({
      participantId,
      position: index + 1
    })),
    desertedPositions,
    eligibleParticipantIds: [...orderedParticipantIds, ...extraEligible]
  };
}

export const REGULATORY_FIXTURES: RegulatoryFixture[] = [
  {
    id: "R-F2-SUM-3J",
    ruleId: "R-F2-SUM",
    status: "CONFIRMADA",
    judgeCount: 3,
    // Consolidación por puesto: A/B/C coinciden en 1.º/2.º/3.º (≥2 votos cada uno).
    // La suma se conserva para auditoría, pero no compacta puestos.
    cards: [
      card("j1", ["A", "B", "C"]),
      card("j2", ["A", "B", "C"]),
      card("j3", ["A", "B", "C"])
    ],
    expect: {
      positions: { A: 1, B: 2, C: 3 },
      hasBlockingTie: false
    }
  },
  {
    id: "R-F2-MAJ1-3J",
    ruleId: "R-F2-MAJ1",
    status: "CONFIRMADA",
    judgeCount: 3,
    cards: [
      card("j1", ["A", "B", "C"]),
      card("j2", ["A", "B", "C"]),
      card("j3", ["B", "C", "A"])
    ],
    expect: {
      majorityWinnerId: "A",
      positions: { A: 1 },
      hasBlockingTie: false
    }
  },
  {
    id: "R-F2-MAJ1-5J",
    ruleId: "R-F2-MAJ1",
    status: "CONFIRMADA",
    judgeCount: 5,
    cards: [
      card("j1", ["A", "B", "C"]),
      card("j2", ["A", "B", "C"]),
      card("j3", ["A", "C", "B"]),
      card("j4", ["B", "A", "C"]),
      card("j5", ["B", "C", "A"])
    ],
    expect: {
      majorityWinnerId: "A",
      positions: { A: 1 },
      hasBlockingTie: false
    }
  },
  {
    id: "R-F2-TIE-SUM-2J",
    ruleId: "R-F2-TIE-SUM",
    status: "CONFIRMADA",
    judgeCount: 2,
    // Sin mayoría por puesto (1-1), ambos puestos quedan desiertos.
    // La igualdad de suma residual queda fuera del top 5 y no bloquea cierre.
    cards: [card("j1", ["A", "B"]), card("j2", ["B", "A"])],
    expect: {
      majorityWinnerId: null,
      hasBlockingTie: false,
      tieReasons: ["SUM_EQUALITY"]
    }
  },
  {
    id: "R-F2-5E-3J",
    ruleId: "R-F2-5E",
    status: "CONFIRMADA",
    judgeCount: 3,
    cards: [
      card("j1", ["A", "B", "C", "D", "E"], ["F", "G"]),
      card("j2", ["A", "B", "C", "D", "F"], ["E", "G"]),
      card("j3", ["A", "B", "C", "D", "G"], ["E", "F"])
    ],
    expect: {
      hasBlockingTie: true,
      tieReasons: ["FIFTH_PLACE_EXCEPTION_5E"],
      fifthExceptionParticipants: ["E", "F", "G"]
    }
  },
  {
    id: "R-F2-5E-EXCL-1-4",
    ruleId: "R-F2-5E-EXCL",
    status: "DECISIÓN_OPERATIVA",
    judgeCount: 3,
    // E queda 3.º por suma pero también es el quinto de j1 → se excluye del bloque 5.e.
    cards: [
      {
        judgeUserId: "j1",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "C", position: 3 },
          { participantId: "D", position: 4 },
          { participantId: "E", position: 5 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: ["A", "B", "C", "D", "E", "F", "G"]
      },
      {
        judgeUserId: "j2",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "E", position: 3 },
          { participantId: "D", position: 4 },
          { participantId: "F", position: 5 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: ["A", "B", "C", "D", "E", "F", "G"]
      },
      {
        judgeUserId: "j3",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "E", position: 3 },
          { participantId: "D", position: 4 },
          { participantId: "G", position: 5 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: ["A", "B", "C", "D", "E", "F", "G"]
      }
    ],
    expect: {
      hasBlockingTie: true,
      tieReasons: ["FIFTH_PLACE_EXCEPTION_5E"],
      // Solo F y G disputan el quinto; E ya tiene 1º–4º provisional.
      fifthExceptionParticipants: ["F", "G"],
      positions: { A: 1, B: 2, E: 3 }
    }
  },
  {
    id: "R-F2-1J-NO-5E",
    ruleId: "R-F2-5E",
    status: "CONFIRMADA",
    judgeCount: 1,
    cards: [card("j1", ["A", "B", "C", "D", "E"])],
    expect: {
      hasBlockingTie: false,
      tieReasons: []
    }
  },
  {
    id: "R-F2-PENALTY-6",
    ruleId: "R-F2-PENALTY",
    status: "EXCEPCIÓN_CONOCIDA",
    judgeCount: 3,
    cards: [
      {
        judgeUserId: "j1",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: ["A", "B", "C"]
      },
      {
        judgeUserId: "j2",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: ["A", "B", "C"]
      },
      {
        judgeUserId: "j3",
        positions: [{ participantId: "A", position: 1 }],
        desertedPositions: [],
        eligibleParticipantIds: ["A", "B", "C"]
      }
    ],
    expect: {
      // C recibe castigo 6 en las 3 tarjetas (suma 18); B recibe un castigo en j3.
      positions: { A: 1, B: 2 }
    }
  }
];
