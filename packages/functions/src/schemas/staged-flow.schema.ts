import { z } from "zod";

export const veterinaryCheckStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "ABSENT"]);

export const updateVeterinaryCheckSchema = z.object({
  status: veterinaryCheckStatusSchema,
  notes: z.string().trim().max(1000).optional().nullable()
});

export const updateFaDecisionsSchema = z.object({
  selectedParticipantIds: z.array(z.string().uuid()).max(10)
});

export const disqualifyParticipantSchema = z.object({
  reasonId: z.string().uuid()
});
