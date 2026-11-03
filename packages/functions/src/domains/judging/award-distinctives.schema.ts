import { z } from "zod";

export const updateAwardDistinctiveSchema = z.object({
  label: z.string().trim().min(1, "El nombre del distintivo es obligatorio.").max(80).optional(),
  colorName: z.string().trim().min(1, "El nombre del color es obligatorio.").max(80).optional(),
  colorHex: z
    .union([
      z.null(),
      z
        .string()
        .trim()
        .regex(/^#[0-9A-Fa-f]{6}$/, "El color hexadecimal debe tener el formato #RRGGBB.")
    ])
    .optional(),
  isActive: z.boolean().optional()
});
