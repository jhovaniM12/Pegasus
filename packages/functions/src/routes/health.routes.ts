import { Hono } from "hono";
import { healthController } from "../controllers/health.controller.js";

export const healthRoutes = new Hono();

healthRoutes.get("/health", healthController);
