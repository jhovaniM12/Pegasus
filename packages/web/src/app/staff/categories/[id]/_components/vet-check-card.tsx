import { CheckCircle2, Clock, MinusCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VeterinaryCheck, VeterinaryCheckStatus } from "@/types/staged-flow";

const VET_STATUSES: VeterinaryCheckStatus[] = ["APPROVED", "REJECTED", "ABSENT", "PENDING"];

const VET_LABELS: Record<VeterinaryCheckStatus, string> = {
  APPROVED: "Aprobado",
  REJECTED: "No aprobado",
  ABSENT: "Ausente",
  PENDING: "Pendiente",
};

function vetCardClass(status: VeterinaryCheckStatus): string {
  switch (status) {
    case "APPROVED": return "border-l-4 border-l-emerald-400 bg-emerald-50/30";
    case "REJECTED": return "border-l-4 border-l-red-400 bg-red-50/30";
    case "ABSENT":   return "border-l-4 border-l-amber-400 bg-amber-50/30";
    case "PENDING":  return "border-l-4 border-l-slate-200 bg-white";
  }
}

function vetButtonClass(btnStatus: VeterinaryCheckStatus, isSelected: boolean, editable: boolean): string {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all focus-visible:outline-none";
  if (isSelected) {
    switch (btnStatus) {
      case "APPROVED": return cn(base, "bg-emerald-500 border-emerald-500 text-white shadow-sm ring-2 ring-emerald-200 cursor-default");
      case "REJECTED": return cn(base, "bg-red-500 border-red-500 text-white shadow-sm ring-2 ring-red-200 cursor-default");
      case "ABSENT":   return cn(base, "bg-amber-500 border-amber-500 text-white shadow-sm ring-2 ring-amber-200 cursor-default");
      case "PENDING":  return cn(base, "bg-slate-400 border-slate-400 text-white shadow-sm ring-2 ring-slate-200 cursor-default");
    }
  }
  if (!editable) return cn(base, "cursor-not-allowed opacity-30 border-slate-200 bg-white text-slate-400");
  switch (btnStatus) {
    case "APPROVED": return cn(base, "bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 cursor-pointer");
    case "REJECTED": return cn(base, "bg-white border-red-200 text-red-700 hover:bg-red-50 hover:border-red-400 cursor-pointer");
    case "ABSENT":   return cn(base, "bg-white border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-400 cursor-pointer");
    case "PENDING":  return cn(base, "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 cursor-pointer");
  }
}

function VetStatusIcon({ status }: { status: VeterinaryCheckStatus }) {
  switch (status) {
    case "APPROVED": return <CheckCircle2 className="size-3.5" />;
    case "REJECTED": return <XCircle className="size-3.5" />;
    case "ABSENT":   return <MinusCircle className="size-3.5" />;
    case "PENDING":  return <Clock className="size-3.5" />;
  }
}

export type VetCheckCardProps = {
  check: VeterinaryCheck;
  editable: boolean;
  isUpdating: boolean;
  onUpdate: (fairEntryId: string, status: VeterinaryCheckStatus) => void;
};

export function VetCheckCard({ check, editable, isUpdating, onUpdate }: VetCheckCardProps) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border border-slate-200 transition-colors",
        vetCardClass(check.status),
        isUpdating && "opacity-80"
      )}
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight text-slate-900">#{check.trackPosition}</p>
          <p className="mt-0.5 truncate text-sm text-slate-500">{check.riderName}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
          {VET_STATUSES.map((status) => {
            const isSelected = check.status === status;
            return (
              <button
                key={status}
                disabled={!editable || isSelected || isUpdating}
                className={vetButtonClass(status, isSelected, editable && !isUpdating)}
                onClick={() => onUpdate(check.fairEntryId, status)}
              >
                <VetStatusIcon status={status} />
                {VET_LABELS[status]}
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}
