import { Hono } from "hono";
import { dispatchNotificationsController } from "../controllers/internal.controller.js";

export const internalRoutes = new Hono();

internalRoutes.get("/internal/notifications/dispatch", dispatchNotificationsController);
