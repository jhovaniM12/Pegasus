"use client";

import { cn } from "@/lib/utils";
import { ReminderIcon } from "@/components/reminder-icon";
import type { RoundAvailableReminder } from "@/types/staged-flow";

type F1RemindersBarProps = {
  reminders: RoundAvailableReminder[];
};

export function F1RemindersBar({ reminders }: F1RemindersBarProps) {
  if (reminders.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        No hay recordatorios activos configurados.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {reminders.map((reminder) => (
        <div
          key={reminder.id}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
          )}
        >
          <ReminderIcon icon={reminder.icon} className="size-3.5 text-slate-600" />
          <span>{reminder.name}</span>
        </div>
      ))}
    </div>
  );
}
