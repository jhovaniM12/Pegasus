import { Hono } from "hono";
import {
  listAwardDistinctivesController,
  updateAwardDistinctiveController
} from "../controllers/award-distinctives.controller.js";

export const awardDistinctivesRoutes = new Hono();

awardDistinctivesRoutes.get("/staff/award-distinctives", listAwardDistinctivesController);
awardDistinctivesRoutes.patch("/staff/award-distinctives/:id", updateAwardDistinctiveController);
