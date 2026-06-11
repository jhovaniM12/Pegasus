import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import { error } from "../lib/http.js";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(error(err.code, err.message), err.statusCode as 400 | 401 | 403 | 404);
  }

  if (err instanceof ZodError) {
    return c.json(
      error("VALIDATION_ERROR", "Parámetros de solicitud inválidos.", err.flatten()),
      400
    );
  }

  console.error("Unhandled error:", err);

  return c.json(error("INTERNAL_ERROR", "Error interno del servidor."), 500);
};
