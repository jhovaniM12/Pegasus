import { Hono } from "hono";
import {
  archiveNotificationController,
  beamsTokenController,
  closeFaController,
  closePreRingController,
  desertCompetitionController,
  closeResultsController,
  closeRoundFormController,
  consolidateFaController,
  consolidateRoundController,
  disqualifyParticipantController,
  getFaController,
  getManagementController,
  getRoundController,
  getRoundByTypeController,
  getRoundsManagementController,
  listDisqualificationReasonsController,
  listNotificationsController,
  getStagedCategoryController,
  listStagedCategoriesController,
  listVeterinaryChecksController,
  markAllNotificationsReadController,
  markNotificationReadController,
  openNextRoundController,
  openTieBreakController,
  resetStageForTestingController,
  startFaController,
  startJudgingController,
  startPreRingController,
  startRoundFormController,
  updateFaDecisionsController,
  updateRoundFormController,
  updateRoundEntryNoteController,
  updateRoundEntryRemindersController,
  disqualifyRoundParticipantController,
  getRoundEntryReminderHistoryController,
  updateVeterinaryCheckController
} from "../controllers/staged-flow.controller.js";

export const stagedFlowRoutes = new Hono();

stagedFlowRoutes.get("/staff/staged-categories", listStagedCategoriesController);
stagedFlowRoutes.get("/staff/staged-categories/:id", getStagedCategoryController);
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

// Rondas F1 / F2 / desempate y resultado oficial
stagedFlowRoutes.post("/staff/fair-categories/:id/rounds/open", openNextRoundController);
stagedFlowRoutes.get("/staff/fair-categories/:id/rounds/current", getRoundController);
stagedFlowRoutes.get("/staff/fair-categories/:id/rounds/management", getRoundsManagementController);
stagedFlowRoutes.get("/staff/fair-categories/:id/rounds/:roundType", getRoundByTypeController);
stagedFlowRoutes.post("/staff/fair-categories/:id/rounds/form/start", startRoundFormController);
stagedFlowRoutes.put("/staff/fair-categories/:id/rounds/form/entries", updateRoundFormController);
stagedFlowRoutes.put(
  "/staff/fair-categories/:id/rounds/form/entries/:participantId/reminders",
  updateRoundEntryRemindersController
);
stagedFlowRoutes.put(
  "/staff/fair-categories/:id/rounds/form/entries/:participantId/note",
  updateRoundEntryNoteController
);
stagedFlowRoutes.post(
  "/staff/fair-categories/:id/rounds/form/entries/:participantId/disqualify",
  disqualifyRoundParticipantController
);
stagedFlowRoutes.get(
  "/staff/fair-categories/:id/rounds/form/reminder-history",
  getRoundEntryReminderHistoryController
);
stagedFlowRoutes.post("/staff/fair-categories/:id/rounds/form/close", closeRoundFormController);
stagedFlowRoutes.post("/staff/fair-categories/:id/rounds/consolidate", consolidateRoundController);
stagedFlowRoutes.post("/staff/fair-categories/:id/rounds/tie-break/open", openTieBreakController);
stagedFlowRoutes.post("/staff/fair-categories/:id/results/close", closeResultsController);
stagedFlowRoutes.post("/staff/fair-categories/:id/results/desert", desertCompetitionController);
