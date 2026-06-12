import type { Context } from "hono";
import { ForbiddenError } from "../lib/errors.js";
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
  listStagedCategories,
  listVeterinaryChecks,
  resetStageForTesting,
  startFa,
  startJudging,
  startPreRing,
  updateFaDecisions,
  updateVeterinaryCheck
} from "../services/staged-flow.service.js";
import { getActiveStaffUser } from "../services/auth.service.js";
import {
  disqualifyParticipantSchema,
  updateFaDecisionsSchema,
  updateVeterinaryCheckSchema
} from "../schemas/staged-flow.schema.js";
import {
  archiveInboxNotification,
  generateBeamsToken,
  listInboxNotifications,
  markAllInboxNotificationsRead,
  markInboxNotificationRead,
  processPendingNotifications
} from "../services/push.service.js";

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

function flushNotifications(): void {
  void processPendingNotifications().catch(() => undefined);
}

export async function listStagedCategoriesController(c: Context) {
  const user = await getStaffUser(c);
  return c.json(success(await listStagedCategories(user)));
}

export async function startPreRingController(c: Context) {
  const user = await getStaffUser(c);
  const result = await startPreRing(user, requiredParam(c, "id"));
  flushNotifications();
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
  flushNotifications();
  return c.json(success(result));
}

export async function startJudgingController(c: Context) {
  const user = await getStaffUser(c);
  const result = await startJudging(user, requiredParam(c, "id"));
  flushNotifications();
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
  flushNotifications();
  return c.json(success(result));
}

export async function closeFaController(c: Context) {
  const user = await getStaffUser(c);
  const result = await closeFa(user, requiredParam(c, "id"));
  flushNotifications();
  return c.json(success(result));
}

export async function getManagementController(c: Context) {
  const user = await getStaffUser(c);
  return c.json(success(await getManagement(user, requiredParam(c, "id"))));
}

export async function consolidateFaController(c: Context) {
  const user = await getStaffUser(c);
  const result = await consolidateFa(user, requiredParam(c, "id"));
  flushNotifications();
  return c.json(success(result));
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
