import { z } from "zod";
import { FEDEQUINAS_FILE_KINDS } from "../services/fedequinas-xlsx.service.js";

export const fedequinasFileKindParamSchema = z.object({
  fileKind: z.enum(FEDEQUINAS_FILE_KINDS)
});

export const fedequinasFairStatusParamSchema = z.object({
  fairExternalId: z.string().trim().min(1).max(255)
});

export const fedequinasPreviewTokenSchema = z.string().trim().min(1);
export const fedequinasChecksumSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{64}$/i, "checksum debe ser un SHA-256 válido.");
