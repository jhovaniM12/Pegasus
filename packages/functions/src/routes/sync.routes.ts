import { Hono } from "hono";
import {
  applyFedequinasController,
  cleanupSyncDevelopmentController,
  getFedequinasFairStatusController,
  getSyncBatchController,
  listSyncBatchesController,
  listSyncErrorsController,
  listSyncSummariesController,
  previewFedequinasController,
  runSyncController
} from "../controllers/sync.controller.js";

export const syncRoutes = new Hono();

syncRoutes.get("/sync/summary", listSyncSummariesController);
syncRoutes.post("/sync/fedequinas/:fileKind/preview", previewFedequinasController);
syncRoutes.post("/sync/fedequinas/:fileKind/apply", applyFedequinasController);
syncRoutes.get(
  "/sync/fedequinas/fairs/:fairExternalId/status",
  getFedequinasFairStatusController
);
syncRoutes.post("/sync/:entity/run", runSyncController);
syncRoutes.get("/sync/batches", listSyncBatchesController);
syncRoutes.get("/sync/batches/:id", getSyncBatchController);
syncRoutes.get("/sync/batches/:id/errors", listSyncErrorsController);
syncRoutes.post("/sync/dev/cleanup", cleanupSyncDevelopmentController);
