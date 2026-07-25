import { z } from "zod";
import { offlineMutationEnvelopeSchema } from "./offline-mutation.schema.js";

export const veterinaryCheckStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "ABSENT"]);

export const updateVeterinaryCheckPayloadSchema = z.object({
  status: veterinaryCheckStatusSchema,
  notes: z.string().trim().max(1000).optional().nullable()
});

export const updateVeterinaryCheckSchema = z.union([
  updateVeterinaryCheckPayloadSchema,
  offlineMutationEnvelopeSchema(updateVeterinaryCheckPayloadSchema)
]);

export const updateFaDecisionsPayloadSchema = z.object({
  selectedParticipantIds: z.array(z.string().uuid()).max(10)
});

export const updateFaDecisionsSchema = z.union([
  updateFaDecisionsPayloadSchema,
  offlineMutationEnvelopeSchema(updateFaDecisionsPayloadSchema)
]);

export const closeFaSchema = z.object({
  // Un arreglo vacío es válido: el reglamento permite cerrar FA sin seleccionar ejemplares.
  selectedParticipantIds: z.array(z.string().uuid()).max(10)
});

export const disqualifyParticipantSchema = z.object({
  reasonId: z.string().uuid()
});

export const tieBreakTestTypeSchema = z.enum([
  "DOUBLE_TABLE",
  "DIRECTION_CHANGE",
  "PARALLEL",
  "CIRCLES",
  "STOP_AND_GO",
  "GAIT_CHANGE",
  "MOUNT"
]);

/**
 * Entrada de tarjeta por juez para una ronda. F1 usa `selectedParticipantIds`
 * (cabeza de lote, máx. 7); F2/desempate usa `positions` (puestos ordinales únicos).
 */
export const updateRoundFormPayloadSchema = z
  .object({
    selectedParticipantIds: z.array(z.string().uuid()).max(20).optional(),
    desertedPositions: z.array(z.number().int().min(1).max(5)).max(5).optional(),
    positions: z
      .array(
        z.object({
          participantId: z.string().uuid(),
          position: z.number().int().min(1).max(50)
        })
      )
      .max(50)
      .optional()
  })
  .refine(
    (value) =>
      value.selectedParticipantIds !== undefined ||
      value.positions !== undefined ||
      value.desertedPositions !== undefined,
    {
      message: "Debes enviar selecciones (F1) o puestos/desiertos (F2)."
    }
  );

export const updateRoundFormOfflinePayloadSchema = updateRoundFormPayloadSchema.and(
  z.object({
    roundId: z.string().uuid(),
    tieBlockIdentity: z.string().min(1).max(500)
  })
);

export const updateRoundFormSchema = z.union([
  updateRoundFormPayloadSchema,
  offlineMutationEnvelopeSchema(updateRoundFormOfflinePayloadSchema)
]);

export const closeRoundFormSchema = updateRoundFormOfflinePayloadSchema.and(
  z.object({
    expectedRevision: z.number().int().nonnegative()
  })
);

export const desertCompetitionSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable()
});

export const openTieBreakSchema = z.object({
  testTypes: z.array(tieBreakTestTypeSchema).min(1).max(1)
});

export const roundEntryReminderEffectSchema = z.enum(["SUMA", "RESTA"]);

export const updateRoundEntryRemindersPayloadSchema = z.object({
  reminders: z
    .array(
      z.object({
        reminderId: z.string().uuid(),
        effect: roundEntryReminderEffectSchema
      })
    )
    .max(30),
  roundId: z.string().uuid().optional(),
  tieBlockIdentity: z.string().min(1).max(500).optional()
});

export const updateRoundEntryRemindersSchema = z.union([
  updateRoundEntryRemindersPayloadSchema,
  offlineMutationEnvelopeSchema(
    updateRoundEntryRemindersPayloadSchema.required({
      roundId: true,
      tieBlockIdentity: true
    })
  )
]);

export const updateRoundEntryNotePayloadSchema = z.object({
  note: z.union([z.null(), z.string().trim().max(1000)]).optional(),
  roundId: z.string().uuid().optional(),
  tieBlockIdentity: z.string().min(1).max(500).optional()
});

export const updateRoundEntryNoteSchema = z.union([
  updateRoundEntryNotePayloadSchema,
  offlineMutationEnvelopeSchema(
    updateRoundEntryNotePayloadSchema.required({
      roundId: true,
      tieBlockIdentity: true
    })
  )
]);
