import type { Context } from "hono";
import { UnauthorizedError } from "../lib/errors.js";
import { success } from "../lib/http.js";
import { dispatchPendingNotifications } from "../services/notification-send.service.js";

function assertCronSecret(c: Context): void {
  const secret = process.env.CRON_SECRET;
  const authorization = c.req.header("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    throw new UnauthorizedError("No autorizado.");
  }
}

export async function dispatchNotificationsController(c: Context) {
  assertCronSecret(c);

  const parsedLimit = Number(c.req.query("limit") ?? 50);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 50;

  return c.json(success(await dispatchPendingNotifications({ limit })));
}
