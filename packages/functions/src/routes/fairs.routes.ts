import { Hono } from "hono";
import {
  getFairEntriesSummaryController,
  getFairController,
  listFairEntriesController,
  listFairResultsController,
  listFairsController,
  listFairStaffController
} from "../controllers/fairs.controller.js";

export const fairsRoutes = new Hono();

fairsRoutes.get("/fairs", listFairsController);
fairsRoutes.get("/fairs/:id", getFairController);
fairsRoutes.get("/fairs/:id/entries/summary", getFairEntriesSummaryController);
fairsRoutes.get("/fairs/:id/entries", listFairEntriesController);
fairsRoutes.get("/fairs/:id/results", listFairResultsController);
fairsRoutes.get("/fairs/:id/staff", listFairStaffController);
