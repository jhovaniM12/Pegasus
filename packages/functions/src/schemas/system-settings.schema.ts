import { z } from "zod";
import {
  MAX_F1_MAX_SELECTIONS,
  MIN_F1_MAX_SELECTIONS
} from "../services/system-settings.service.js";

export const updateJudgingSystemSettingsSchema = z.object({
  f1MaxSelections: z
    .number()
    .int("El límite de F1 debe ser un número entero.")
    .min(MIN_F1_MAX_SELECTIONS, `El límite de F1 debe ser mínimo ${MIN_F1_MAX_SELECTIONS}.`)
    .max(MAX_F1_MAX_SELECTIONS, `El límite de F1 debe ser máximo ${MAX_F1_MAX_SELECTIONS}.`)
});
