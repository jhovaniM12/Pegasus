"use client";

import { X } from "lucide-react";

import { ReminderIcon } from "@/components/reminder-icon";
import { cn } from "@/lib/utils";
import type { RoundReminderHistoryItem } from "@/types/staged-flow";

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "short",
  timeStyle: "short",
});

type F1ReminderHistoryProps = {
  items: RoundReminderHistoryItem[];
  onClose: () => void;
};

export function F1ReminderHistory({ items, onClose }: F1ReminderHistoryProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-950">Historial de marcas</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Cerrar historial"
        >
          <X className="size-4" />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Aún no has registrado marcas en esta tarjeta.</p>
      ) : (
        <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
            >
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  item.effect === "SUMA" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                )}
              >
                <ReminderIcon icon={item.reminderIcon} className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    #{item.trackPosition} {item.riderName}
                  </p>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      item.effect === "SUMA"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    )}
                  >
                    {item.effect}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-600">{item.reminderName}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {dateTimeFormatter.format(new Date(item.createdAt))}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
