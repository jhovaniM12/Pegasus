import { z } from "zod";

export const uuidParamSchema = z.object({
  id: z.string().uuid("El identificador debe ser un UUID válido.")
});
