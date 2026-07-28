import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Bookmark,
  Check,
  CheckCircle,
  Circle,
  Flag,
  Heart,
  Info,
  Minus,
  Plus,
  Square,
  Star,
  Tag,
  Triangle,
  X,
  XCircle,
  Zap
} from "lucide-react";

import type { ReminderIconKey } from "@/types/judging-reminders";

const REMINDER_ICON_MAP: Record<ReminderIconKey, LucideIcon> = {
  "check-circle": CheckCircle,
  "x-circle": XCircle,
  "alert-circle": AlertCircle,
  star: Star,
  heart: Heart,
  flag: Flag,
  bookmark: Bookmark,
  tag: Tag,
  bell: Bell,
  info: Info,
  check: Check,
  x: X,
  plus: Plus,
  minus: Minus,
  "alert-triangle": AlertTriangle,
  circle: Circle,
  square: Square,
  triangle: Triangle,
  zap: Zap
};

export type ReminderEffectTone = "SUMA" | "RESTA";

/** Clases de color para chips/iconos según efecto SUMA (azul) / RESTA (rojo). */
export function reminderEffectToneClass(effect: ReminderEffectTone): string {
  return effect === "SUMA"
    ? "border-blue-200 bg-blue-50 text-blue-700"
    : "border-red-200 bg-red-50 text-red-700";
}

export function reminderEffectIconClass(effect: ReminderEffectTone): string {
  return effect === "SUMA" ? "text-blue-600" : "text-red-600";
}

type ReminderIconProps = {
  icon: ReminderIconKey | string;
  className?: string;
  /** Si se indica, aplica azul (SUMA) o rojo (RESTA) al icono. */
  effect?: ReminderEffectTone;
};

export function ReminderIcon({ icon, className, effect }: ReminderIconProps) {
  const Icon = REMINDER_ICON_MAP[icon as ReminderIconKey] ?? Circle;
  return (
    <Icon
      className={[effect ? reminderEffectIconClass(effect) : null, className]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    />
  );
}
