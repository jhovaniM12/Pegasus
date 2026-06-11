import { Hono } from "hono";
import {
  loginController,
  logoutController,
  meController
} from "../controllers/auth.controller.js";
import { requireRootSession } from "../middlewares/auth.middleware.js";

export const authRoutes = new Hono();

authRoutes.post("/auth/login", loginController);
authRoutes.post("/auth/logout", logoutController);
authRoutes.get("/auth/me", requireRootSession, meController);
