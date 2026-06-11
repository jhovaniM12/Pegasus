import type { Context } from "hono";
import { success } from "../lib/http.js";
import { clearSessionCookie, getSessionFromCookie, setSessionCookie } from "../lib/session.js";
import { toUserDto } from "../mappers/user.mapper.js";
import { loginSchema } from "../schemas/auth.schema.js";
import { getActiveRootUser, loginRootUser } from "../services/auth.service.js";

export async function loginController(c: Context) {
  const body = loginSchema.parse(await c.req.json());
  const result = await loginRootUser(body);

  setSessionCookie(c, result.token);

  return c.json(success(toUserDto(result.user)));
}

export async function logoutController(c: Context) {
  clearSessionCookie(c);

  return c.json(success({ ok: true }));
}

export async function meController(c: Context) {
  const session = getSessionFromCookie(c);
  const user = await getActiveRootUser(session.userId);

  return c.json(success(toUserDto(user)));
}
