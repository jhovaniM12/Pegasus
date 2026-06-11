import type { Context } from "hono";
import { success } from "../lib/http.js";
import { clearSessionCookie, getSessionFromCookie, setSessionCookie } from "../lib/session.js";
import { toUserDto } from "../mappers/user.mapper.js";
import { accessCodeLoginSchema, loginSchema } from "../schemas/auth.schema.js";
import { getActiveUser, loginByAccessCode, loginRootUser } from "../services/auth.service.js";

export async function loginController(c: Context) {
  const body = loginSchema.parse(await c.req.json());
  const result = await loginRootUser(body);

  setSessionCookie(c, result.token);

  return c.json(success(toUserDto(result.user)));
}

export async function accessCodeLoginController(c: Context) {
  const body = accessCodeLoginSchema.parse(await c.req.json());
  const result = await loginByAccessCode(body);

  setSessionCookie(c, result.token);

  return c.json(success(toUserDto(result.user)));
}

export async function logoutController(c: Context) {
  clearSessionCookie(c);

  return c.json(success({ ok: true }));
}

export async function meController(c: Context) {
  const session = getSessionFromCookie(c);
  const user = await getActiveUser(session.userId);

  return c.json(success(toUserDto(user)));
}
