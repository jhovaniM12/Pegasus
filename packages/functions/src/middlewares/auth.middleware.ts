import type { MiddlewareHandler } from "hono";
import { getSessionFromCookie } from "../lib/session.js";
import {
  getActiveRootUser,
  getActiveStaffUser,
  getActiveUser
} from "../services/auth.service.js";

export const requireSession: MiddlewareHandler = async (c, next) => {
  const session = getSessionFromCookie(c);
  await getActiveUser(session.userId);
  await next();
};

export const requireRootSession: MiddlewareHandler = async (c, next) => {
  const session = getSessionFromCookie(c);
  await getActiveRootUser(session.userId);
  await next();
};

export const requireStaffSession: MiddlewareHandler = async (c, next) => {
  const session = getSessionFromCookie(c);
  await getActiveStaffUser(session.userId);
  await next();
};
