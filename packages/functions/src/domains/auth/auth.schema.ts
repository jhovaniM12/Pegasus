import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1)
});

export const accessCodeLoginSchema = z.object({
  accessCode: z
    .string()
    .trim()
    .length(6, "El código de acceso debe tener 6 caracteres.")
    .regex(/^[a-zA-Z0-9]+$/, "El código de acceso solo puede contener letras y números.")
});
