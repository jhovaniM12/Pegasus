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

export const REMINDER_ICON_LABELS: Record<ReminderIconKey, string> = {
  "check-circle": "Check Circle",
  "x-circle": "X Circle",
  "alert-circle": "Alert Circle",
  star: "Star",
  heart: "Heart",
  flag: "Flag",
  bookmark: "Bookmark",
  tag: "Tag",
  bell: "Bell",
  info: "Info",
  check: "Check",
  x: "X",
  plus: "Plus",
  minus: "Minus",
  "alert-triangle": "Alert Triangle",
  circle: "Circle",
  square: "Square",
  triangle: "Triangle",
  zap: "Zap"
};

export type JudgingReminder = {
  id: string;
  name: string;
  icon: ReminderIconKey;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateJudgingReminderInput = {
  name: string;
  icon: ReminderIconKey;
  isActive?: boolean;
};

export type UpdateJudgingReminderInput = Partial<CreateJudgingReminderInput>;
