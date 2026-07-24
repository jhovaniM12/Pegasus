import { z } from "zod";

export const peopleQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  fairId: z.string().uuid("El identificador de feria debe ser un UUID válido.").optional()
});

export const assignAccessCodeSchema = z.object({
  accessCode: z
    .string()
    .trim()
    .length(6, "El código de acceso debe tener 6 caracteres.")
    .regex(/^[a-zA-Z0-9]+$/, "El código de acceso solo puede contener letras y números.")
});

export const checkAccessCodeQuerySchema = z.object({
  accessCode: z
    .string()
    .trim()
    .length(6, "El código de acceso debe tener 6 caracteres.")
    .regex(/^[a-zA-Z0-9]+$/, "El código de acceso solo puede contener letras y números."),
  personId: z.string().uuid("El identificador de persona debe ser un UUID válido.").optional()
});
