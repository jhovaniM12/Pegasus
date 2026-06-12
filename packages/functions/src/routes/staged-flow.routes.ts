import { Hono } from "hono";
import {
  archiveNotificationController,
  beamsTokenController,
  closeFaController,
  closePreRingController,
  consolidateFaController,
  disqualifyParticipantController,
  getFaController,
  getManagementController,
  listDisqualificationReasonsController,
  listNotificationsController,
  listStagedCategoriesController,
  listVeterinaryChecksController,
  markAllNotificationsReadController,
  markNotificationReadController,
  resetStageForTestingController,
  startFaController,
  startJudgingController,
  startPreRingController,
  updateFaDecisionsController,
  updateVeterinaryCheckController
} from "../controllers/staged-flow.controller.js";

export const stagedFlowRoutes = new Hono();

stagedFlowRoutes.get("/staff/staged-categories", listStagedCategoriesController);
stagedFlowRoutes.get("/staff/notifications", listNotificationsController);
stagedFlowRoutes.patch("/staff/notifications/read-all", markAllNotificationsReadController);
stagedFlowRoutes.patch("/staff/notifications/:notificationId/read", markNotificationReadController);
stagedFlowRoutes.patch("/staff/notifications/:notificationId/archive", archiveNotificationController);
stagedFlowRoutes.get("/staff/push/beams-token", beamsTokenController);
stagedFlowRoutes.post("/staff/push/beams-token", beamsTokenController);
stagedFlowRoutes.post("/staff/fair-categories/:id/pre-ring/start", startPreRingController);
stagedFlowRoutes.post("/staff/fair-categories/:id/reset-for-testing", resetStageForTestingController);
stagedFlowRoutes.get("/staff/fair-categories/:id/veterinary-checks", listVeterinaryChecksController);
stagedFlowRoutes.patch(
  "/staff/fair-categories/:id/veterinary-checks/:fairEntryId",
  updateVeterinaryCheckController
);
stagedFlowRoutes.post("/staff/fair-categories/:id/pre-ring/close", closePreRingController);
stagedFlowRoutes.post("/staff/fair-categories/:id/judging/start", startJudgingController);
stagedFlowRoutes.get("/staff/fair-categories/:id/fa", getFaController);
stagedFlowRoutes.post("/staff/fair-categories/:id/fa/start", startFaController);
stagedFlowRoutes.put("/staff/fair-categories/:id/fa/decisions", updateFaDecisionsController);
stagedFlowRoutes.get(
  "/staff/fair-categories/:id/fa/disqualification-reasons",
  listDisqualificationReasonsController
);
stagedFlowRoutes.post(
  "/staff/fair-categories/:id/fa/participants/:judgingParticipantId/disqualify",
  disqualifyParticipantController
);
stagedFlowRoutes.post("/staff/fair-categories/:id/fa/close", closeFaController);
stagedFlowRoutes.get("/staff/fair-categories/:id/management", getManagementController);
stagedFlowRoutes.post("/staff/fair-categories/:id/fa/consolidate", consolidateFaController);
