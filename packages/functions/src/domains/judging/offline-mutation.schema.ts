import { z } from "zod";

export const offlineMutationMetadataSchema = z.object({
  operationId: z.string().uuid(),
  baseRevision: z.number().int().nonnegative(),
  clientUpdatedAt: z.string().datetime({ offset: true }),
});

export function offlineMutationEnvelopeSchema<TSchema extends z.ZodTypeAny>(
  payloadSchema: TSchema
) {
  return offlineMutationMetadataSchema.extend({
    payload: payloadSchema,
  });
}
