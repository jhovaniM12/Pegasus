import { z } from "zod";

export const peopleQuerySchema = z.object({
  search: z.string().trim().min(1).optional()
});
