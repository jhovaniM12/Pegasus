import { Hono } from "hono";
import {
  accessCodeLoginController,
  loginController,
  logoutController,
  meController
} from "../controllers/auth.controller.js";
import { requireSession } from "../middlewares/auth.middleware.js";

export const authRoutes = new Hono();

authRoutes.post("/auth/login", loginController);
authRoutes.post("/auth/access-code", accessCodeLoginController);
authRoutes.post("/auth/logout", logoutController);
authRoutes.get("/auth/me", requireSession, meController);
