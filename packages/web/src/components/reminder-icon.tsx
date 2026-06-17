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

type ReminderIconProps = {
  icon: ReminderIconKey | string;
  className?: string;
};

export function ReminderIcon({ icon, className }: ReminderIconProps) {
  const Icon = REMINDER_ICON_MAP[icon as ReminderIconKey] ?? Circle;
  return <Icon className={className} aria-hidden />;
}
