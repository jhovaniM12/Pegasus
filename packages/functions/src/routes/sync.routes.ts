import { Hono } from "hono";
import {
  cleanupSyncDevelopmentController,
  getSyncBatchController,
  listSyncBatchesController,
  listSyncErrorsController,
  listSyncSummariesController,
  runSyncController
} from "../controllers/sync.controller.js";

export const syncRoutes = new Hono();

syncRoutes.get("/sync/summary", listSyncSummariesController);
syncRoutes.post("/sync/:entity/run", runSyncController);
syncRoutes.get("/sync/batches", listSyncBatchesController);
syncRoutes.get("/sync/batches/:id", getSyncBatchController);
syncRoutes.get("/sync/batches/:id/errors", listSyncErrorsController);
syncRoutes.post("/sync/dev/cleanup", cleanupSyncDevelopmentController);
