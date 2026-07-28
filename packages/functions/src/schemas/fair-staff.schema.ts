import { z } from "zod";

export const updateFairStaffJudgeSeatSchema = z.object({
  judgeSeat: z
    .union([
      z.null(),
      z
        .number()
        .int("El asiento del juez debe ser un entero.")
        .min(1, "El asiento del juez debe estar entre 1 y 5.")
        .max(5, "El asiento del juez debe estar entre 1 y 5.")
    ])
    .describe("Asiento fijo del juez en el panel (1–5), o null para quitarlo.")
});

export const fairStaffParamsSchema = z.object({
  id: z.string().uuid("El identificador de la feria debe ser un UUID válido."),
  staffId: z.string().uuid("El identificador del staff debe ser un UUID válido.")
});
