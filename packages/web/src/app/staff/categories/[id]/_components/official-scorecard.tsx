import { ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoundManagementForm, RoundResult } from "@/types/staged-flow";

type OfficialScorecardProps = {
  fairName: string | null;
  fairStartDate?: string | null;
  fairEndDate?: string | null;
  categoryName: string | null;
  forms: RoundManagementForm[];
  results: RoundResult[];
  className?: string;
};

const ORDINAL_LABELS: Record<number, string> = {
  1: "Primero",
  2: "Segundo",
  3: "Tercero",
  4: "Cuarto",
  5: "Quinto",
};

const FALLBACK_POSITION_COLORS: Record<number, string> = {
  1: "#93c5fd",
  2: "#f9a8d4",
  3: "#fde68a",
  4: "#86efac",
  5: "#c4b5fd",
};

function ordinalLabel(position: number): string {
  return ORDINAL_LABELS[position] ?? `Puesto ${position}`;
}

function readableTextColor(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#0f172a";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0f172a" : "#ffffff";
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, day))
  );
}

function formatDateRange(start?: string | null, end?: string | null): string | null {
  if (!start && !end) return null;
  if (start && end && start !== end) return `Del ${formatDate(start)} al ${formatDate(end)}`;
  return formatDate((start ?? end) as string);
}

export function OfficialScorecard({
  fairName,
  fairStartDate,
  fairEndDate,
  categoryName,
  forms,
  results,
  className,
}: OfficialScorecardProps) {
  const rows = [...results]
    .filter((row) => row.finalPosition != null)
    .sort((a, b) => a.trackPosition - b.trackPosition);

  if (rows.length === 0 || forms.length === 0) {
    return null;
  }

  const dateRange = formatDateRange(fairStartDate, fairEndDate);

  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      <div className="flex items-center gap-2 border-b border-slate-200/60 bg-slate-50/80 px-5 py-3">
        <ClipboardList className="size-4.5 text-slate-600" />
        <span className="text-base font-semibold text-slate-800">Planilla de jueces</span>
      </div>

      <div className="border-b border-slate-100 px-5 py-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {fairName ?? "Feria"}
        </p>
        {dateRange && <p className="mt-0.5 text-xs text-slate-400">{dateRange}</p>}
        <p className="mt-1.5 text-base font-semibold text-slate-900">{categoryName ?? "Categoría"}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-center text-sm">
          <thead>
            <tr className="border-b border-slate-200/60 bg-slate-50/40 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2.5 text-center">Ejemplar</th>
              <th className="px-3 py-2.5 text-center">Puesto</th>
              {forms.map((form) => (
                <th key={form.id} className="min-w-[9rem] px-3 py-2.5 text-center">
                  {form.judgeName}
                </th>
              ))}
              <th className="px-3 py-2.5 text-center">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const distinctiveHex = row.awardDistinctive?.colorHex ?? null;
              const finalPosition = row.finalPosition as number;
              const positionColor = distinctiveHex ?? FALLBACK_POSITION_COLORS[finalPosition] ?? "#e2e8f0";

              return (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2.5 align-middle font-semibold tabular-nums text-slate-800">
                    {row.trackPosition}
                  </td>
                  <td className="p-0 align-middle">
                    <div
                      className="flex h-full items-center justify-center px-3 py-2.5 text-sm font-bold"
                      style={{ backgroundColor: positionColor, color: readableTextColor(positionColor) }}
                    >
                      {ordinalLabel(finalPosition)}
                    </div>
                  </td>
                  {forms.map((form) => {
                    const entry = form.entries.find((item) => item.participantId === row.participantId);
                    return (
                      <td key={form.id} className="px-3 py-2.5 align-middle tabular-nums text-slate-700">
                        {entry?.position ?? "—"}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 align-middle text-base font-bold tabular-nums text-slate-900">
                    {row.scoreValue}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
