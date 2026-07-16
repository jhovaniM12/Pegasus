import type { Context } from "hono";
import { BadRequestError, ForbiddenError } from "../lib/errors.js";
import { success } from "../lib/http.js";
import { getSessionFromCookie } from "../lib/session.js";
import {
  consolidateFa,
  closeFa,
  closePreRing,
  disqualifyParticipant,
  getFa,
  getManagement,
  listDisqualificationReasons,
  getStagedCategory,
  listStagedCategories,
  listVeterinaryChecks,
  resetStageForTesting,
  startFa,
  startJudging,
  startPreRing,
  updateFaDecisions,
  updateVeterinaryCheck
} from "../services/staged-flow.service.js";
import {
  closeResults,
  closeRoundForm,
  consolidateRound,
  desertCompetition,
  disqualifyRoundParticipant,
  getRound,
  getRoundByType,
  getRoundsManagement,
  openNextRound,
  openTieBreak,
  startRoundForm,
  updateRoundForm
} from "../services/judging/round.service.js";
import {
  getEntryReminderHistory,
  updateEntryPrivateNote,
  updateEntryReminders
} from "../services/judging/round-entry-annotations.service.js";
import { getActiveStaffUser } from "../services/auth.service.js";
import {
  disqualifyParticipantSchema,
  desertCompetitionSchema,
  openTieBreakSchema,
  updateFaDecisionsSchema,
  updateRoundEntryNoteSchema,
  updateRoundEntryRemindersSchema,
  updateRoundFormSchema,
  updateVeterinaryCheckSchema
} from "../schemas/staged-flow.schema.js";
import {
  archiveInboxNotification,
  generateBeamsToken,
  listInboxNotifications,
  markAllInboxNotificationsRead,
  markInboxNotificationRead
} from "../services/push.service.js";
import { dispatchPendingNotifications } from "../services/notification-send.service.js";

async function getStaffUser(c: Context) {
  const session = getSessionFromCookie(c);
  return getActiveStaffUser(session.userId);
}

function requiredParam(c: Context, name: string): string {
  const value = c.req.param(name);

  if (!value) {
    throw new Error(`Parametro requerido: ${name}`);
  }

  return value;
}

async function dispatchNotificationsAfterAction(): Promise<void> {
  await dispatchPendingNotifications({ limit: 50 }).catch((error) => {
    console.log(
      JSON.stringify({
        level: "ERROR",
        service: process.env.SERVICE_NAME ?? "pegasus-api",
        event: "NOTIFICATION_DISPATCH_SCHEDULE_FAILED",
        error: error instanceof Error ? error.message : "Error desconocido.",
        ts: new Date().toISOString()
      })
    );
  });
}

export async function listStagedCategoriesController(c: Context) {
  const user = await getStaffUser(c);
  return c.json(success(await listStagedCategories(user)));
}

export async function getStagedCategoryController(c: Context) {
  const user = await getStaffUser(c);
  return c.json(success(await getStagedCategory(user, requiredParam(c, "id"))));
}

export async function startPreRingController(c: Context) {
  const user = await getStaffUser(c);
  const result = await startPreRing(user, requiredParam(c, "id"));
  await dispatchNotificationsAfterAction();
  return c.json(success(result));
}

export async function listVeterinaryChecksController(c: Context) {
  const user = await getStaffUser(c);
  return c.json(success(await listVeterinaryChecks(user, requiredParam(c, "id"))));
}

export async function updateVeterinaryCheckController(c: Context) {
  const user = await getStaffUser(c);
  const body = updateVeterinaryCheckSchema.parse(await c.req.json());
  return c.json(success(await updateVeterinaryCheck(user, requiredParam(c, "id"), requiredParam(c, "fairEntryId"), body)));
}

export async function closePreRingController(c: Context) {
  const user = await getStaffUser(c);
  const result = await closePreRing(user, requiredParam(c, "id"));
  await dispatchNotificationsAfterAction();
  return c.json(success(result));
}

export async function startJudgingController(c: Context) {
  const user = await getStaffUser(c);
  const result = await startJudging(user, requiredParam(c, "id"));
  await dispatchNotificationsAfterAction();
  return c.json(success(result));
}

export async function getFaController(c: Context) {
  const user = await getStaffUser(c);
  return c.json(success(await getFa(user, requiredParam(c, "id"))));
}

export async function startFaController(c: Context) {
  const user = await getStaffUser(c);
  return c.json(success(await startFa(user, requiredParam(c, "id"))));
}

export async function updateFaDecisionsController(c: Context) {
  const user = await getStaffUser(c);
  const body = updateFaDecisionsSchema.parse(await c.req.json());
  return c.json(success(await updateFaDecisions(user, requiredParam(c, "id"), body)));
}

export async function listDisqualificationReasonsController(c: Context) {
  return c.json(success(await listDisqualificationReasons()));
}

export async function disqualifyParticipantController(c: Context) {
  const user = await getStaffUser(c);
  const body = disqualifyParticipantSchema.parse(await c.req.json());
  const result = await disqualifyParticipant(user, requiredParam(c, "id"), requiredParam(c, "judgingParticipantId"), body.reasonId);
  await dispatchNotificationsAfterAction();
  return c.json(success(result));
}

export async function closeFaController(c: Context) {
  const user = await getStaffUser(c);
  const result = await closeFa(user, requiredParam(c, "id"));
  await dispatchNotificationsAfterAction();
  return c.json(success(result));
}

export async function getManagementController(c: Context) {
  const user = await getStaffUser(c);
  return c.json(success(await getManagement(user, requiredParam(c, "id"))));
}

export async function consolidateFaController(c: Context) {
  const user = await getStaffUser(c);
  const result = await consolidateFa(user, requiredParam(c, "id"));
  await dispatchNotificationsAfterAction();
  return c.json(success(result));
}

// ─── Rondas F1 / F2 / desempate ──────────────────────────────────────────────

export async function openNextRoundController(c: Context) {
  const user = await getStaffUser(c);
  const result = await openNextRound(user, requiredParam(c, "id"));
  await dispatchNotificationsAfterAction();
  return c.json(success(result));
}

export async function getRoundController(c: Context) {
  const user = await getStaffUser(c);
  return c.json(success(await getRound(user, requiredParam(c, "id"))));
}

const VALID_ROUND_TYPES = ["F1", "F2", "TIE_BREAK"] as const;

export async function getRoundByTypeController(c: Context) {
  const user = await getStaffUser(c);
  const roundType = requiredParam(c, "roundType");
  if (!VALID_ROUND_TYPES.includes(roundType as (typeof VALID_ROUND_TYPES)[number])) {
    throw new BadRequestError("Tipo de ronda inválido.");
  }
  return c.json(success(await getRoundByType(user, requiredParam(c, "id"), roundType as "F1" | "F2" | "TIE_BREAK")));
}

export async function startRoundFormController(c: Context) {
  const user = await getStaffUser(c);
  return c.json(success(await startRoundForm(user, requiredParam(c, "id"))));
}

export async function updateRoundFormController(c: Context) {
  const user = await getStaffUser(c);
  const body = updateRoundFormSchema.parse(await c.req.json());
  return c.json(success(await updateRoundForm(user, requiredParam(c, "id"), body)));
}

export async function updateRoundEntryRemindersController(c: Context) {
  const user = await getStaffUser(c);
  const stageId = requiredParam(c, "id");
  const participantId = requiredParam(c, "participantId");
  const body = updateRoundEntryRemindersSchema.parse(await c.req.json());
  await updateEntryReminders(user, stageId, participantId, body.reminders);
  return c.json(success(await getRound(user, stageId)));
}

export async function updateRoundEntryNoteController(c: Context) {
  const user = await getStaffUser(c);
  const stageId = requiredParam(c, "id");
  const participantId = requiredParam(c, "participantId");
  const body = updateRoundEntryNoteSchema.parse(await c.req.json());
  await updateEntryPrivateNote(user, stageId, participantId, body.note ?? null);
  return c.json(success(await getRound(user, stageId)));
}

export async function disqualifyRoundParticipantController(c: Context) {
  const user = await getStaffUser(c);
  const body = disqualifyParticipantSchema.parse(await c.req.json());
  const result = await disqualifyRoundParticipant(
    user,
    requiredParam(c, "id"),
    requiredParam(c, "participantId"),
    body.reasonId
  );
  await dispatchNotificationsAfterAction();
  return c.json(success(result));
}

export async function getRoundEntryReminderHistoryController(c: Context) {
  const user = await getStaffUser(c);
  const stageId = requiredParam(c, "id");
  const history = await getEntryReminderHistory(user, stageId);
  return c.json(success(history));
}

export async function closeRoundFormController(c: Context) {
  const user = await getStaffUser(c);
  const result = await closeRoundForm(user, requiredParam(c, "id"));
  await dispatchNotificationsAfterAction();
  return c.json(success(result));
}

export async function consolidateRoundController(c: Context) {
  const user = await getStaffUser(c);
  const result = await consolidateRound(user, requiredParam(c, "id"));
  await dispatchNotificationsAfterAction();
  return c.json(success(result));
}

export async function openTieBreakController(c: Context) {
  const user = await getStaffUser(c);
  const body = openTieBreakSchema.parse(await c.req.json());
  const result = await openTieBreak(user, requiredParam(c, "id"), body);
  await dispatchNotificationsAfterAction();
  return c.json(success(result));
}

export async function closeResultsController(c: Context) {
  const user = await getStaffUser(c);
  const result = await closeResults(user, requiredParam(c, "id"));
  await dispatchNotificationsAfterAction();
  return c.json(success(result));
}

export async function desertCompetitionController(c: Context) {
  const user = await getStaffUser(c);
  const body = desertCompetitionSchema.parse(await c.req.json().catch(() => ({})));
  const result = await desertCompetition(user, requiredParam(c, "id"), body);
  await dispatchNotificationsAfterAction();
  return c.json(success(result));
}

export async function getRoundsManagementController(c: Context) {
  const user = await getStaffUser(c);
  return c.json(success(await getRoundsManagement(user, requiredParam(c, "id"))));
}

export async function resetStageForTestingController(c: Context) {
  const user = await getStaffUser(c);
  return c.json(success(await resetStageForTesting(user, requiredParam(c, "id"))));
}

export async function beamsTokenController(c: Context) {
  const user = await getStaffUser(c);

  const requestedUserId = c.req.query("user_id");
  if (requestedUserId && requestedUserId !== user.id) {
    throw new ForbiddenError("No se puede generar un token push para otro usuario.");
  }

  return c.json(generateBeamsToken(user));
}

export async function listNotificationsController(c: Context) {
  const user = await getStaffUser(c);
  const limit = Number(c.req.query("limit") ?? 20);
  return c.json(success(await listInboxNotifications(user, limit)));
}

export async function markNotificationReadController(c: Context) {
  const user = await getStaffUser(c);
  return c.json(success(await markInboxNotificationRead(user, requiredParam(c, "notificationId"))));
}

export async function markAllNotificationsReadController(c: Context) {
  const user = await getStaffUser(c);
  return c.json(success(await markAllInboxNotificationsRead(user)));
}

export async function archiveNotificationController(c: Context) {
  const user = await getStaffUser(c);
  return c.json(success(await archiveInboxNotification(user, requiredParam(c, "notificationId"))));
}
