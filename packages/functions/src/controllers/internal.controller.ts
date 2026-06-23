import type { Context } from "hono";
import { success } from "../lib/http.js";
import { dispatchPendingNotifications } from "../services/notification-dispatch.service.js";

export async function dispatchNotificationsCronController(c: Context) {
  const result = await dispatchPendingNotifications({
    batchSize: 50,
    maxBatches: 10
  });

  return c.json(success(result));
}
