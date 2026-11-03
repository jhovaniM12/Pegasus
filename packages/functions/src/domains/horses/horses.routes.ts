import { Hono } from "hono";
import { listHorsesController } from "./horses.controller.js";

export const horsesRoutes = new Hono();

horsesRoutes.get("/horses", listHorsesController);
