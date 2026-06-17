import { z } from "zod";

export const REMINDER_ICON_KEYS = [
  "check-circle",
  "x-circle",
  "alert-circle",
  "star",
  "heart",
  "flag",
  "bookmark",
  "tag",
  "bell",
  "info",
  "check",
  "x",
  "plus",
  "minus",
  "alert-triangle",
  "circle",
  "square",
  "triangle",
  "zap"
] as const;

export type ReminderIconKey = (typeof REMINDER_ICON_KEYS)[number];

export const reminderIconSchema = z.enum(REMINDER_ICON_KEYS, {
  errorMap: () => ({ message: "Selecciona un icono válido." })
});

export const judgingRemindersQuerySchema = z.object({
  search: z.string().trim().optional(),
  isActive: z.enum(["true", "false", "all"]).optional().default("all")
});

export const createJudgingReminderSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  icon: reminderIconSchema,
  isActive: z.boolean().optional().default(true)
});

export const updateJudgingReminderSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(120).optional(),
  icon: reminderIconSchema.optional(),
  isActive: z.boolean().optional()
});
