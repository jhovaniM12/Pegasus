import type { Context, Next } from "hono";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";

function readBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length).trim();
}

export async function cronAuthMiddleware(c: Context, next: Next): Promise<Response | void> {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new ForbiddenError("CRON_SECRET no está configurado.");
  }

  const token = readBearerToken(c.req.header("Authorization"));

  if (!token) {
    throw new UnauthorizedError("Token de cron requerido.");
  }

  if (token !== cronSecret) {
    throw new ForbiddenError("Token de cron inválido.");
  }

  await next();
}
