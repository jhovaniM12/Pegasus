import { Hono } from "hono";
import { healthController } from "./health.controller.js";

export const healthRoutes = new Hono();

healthRoutes.get("/health", healthController);
