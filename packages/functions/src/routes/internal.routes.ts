import { Hono } from "hono";
import { dispatchNotificationsCronController } from "../controllers/internal.controller.js";
import { cronAuthMiddleware } from "../middlewares/cron-auth.middleware.js";

export const internalRoutes = new Hono();

internalRoutes.use("/internal/cron/*", cronAuthMiddleware);
internalRoutes.get("/internal/cron/dispatch-notifications", dispatchNotificationsCronController);
