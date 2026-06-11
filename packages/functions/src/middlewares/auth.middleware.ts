import type { MiddlewareHandler } from "hono";
import { getSessionFromCookie } from "../lib/session.js";
import { getActiveRootUser } from "../services/auth.service.js";

export const requireRootSession: MiddlewareHandler = async (c, next) => {
  const session = getSessionFromCookie(c);
  await getActiveRootUser(session.userId);
  await next();
};
