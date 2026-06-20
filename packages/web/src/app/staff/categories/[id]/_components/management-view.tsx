"use client";

import { useState } from "react";
import {
  CheckCircle2,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Gavel,
  MinusCircle,
  Stethoscope,
  Timer,
  Trophy,
  UserX,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FaConsolidatedDetail } from "./fa-consolidated-detail";
import {
  ActivateRoundCard,
  isFaStageComplete,
  resolveActivateRoundConfig,
  type ActivateRoundConfig,
} from "./activate-round-card";
import { RoundsSummarySection } from "./rounds-summary-section";
import { formatFaFormDuration, formatRoundFormTime } from "./round-form-timing";
import type {
  JudgeFormStatus,
  ManagementJudgeForm,
  ManagementState,
  ManagementVetCheck,
  RoundManagementItem,
  VeterinaryCheckStatus,
} from "@/types/staged-flow";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Vet check status ─────────────────────────────────────────────────────────

function vetStatusIcon(status: VeterinaryCheckStatus) {
  switch (status) {
    case "APPROVED":
      return <CheckCircle2 className="size-4 text-emerald-600" />;
    case "REJECTED":
      return <XCircle className="size-4 text-red-600" />;
    case "ABSENT":
      return <MinusCircle className="size-4 text-slate-400" />;
    case "PENDING":
      return <Clock className="size-4 text-amber-600" />;
  }
}

function vetStatusLabel(status: VeterinaryCheckStatus): string {
  switch (status) {
    case "APPROVED": return "Aprobado";
    case "REJECTED": return "Rechazado";
    case "ABSENT":   return "Ausente";
    case "PENDING":  return "Pendiente";
  }
}

function vetStatusBadgeClass(status: VeterinaryCheckStatus): string {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "REJECTED":
      return "bg-red-50 text-red-700 border-red-100";
    case "ABSENT":
      return "bg-slate-50 text-slate-600 border-slate-200";
    case "PENDING":
      return "bg-amber-50 text-amber-700 border-amber-100";
  }
}

// ─── Judge form status ────────────────────────────────────────────────────────

function judgeStatusBadge(status: JudgeFormStatus) {
  switch (status) {
    case "CLOSED":
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="size-3" />
          Cerrado
        </span>
      );
    case "STARTED":
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          <Gavel className="size-3" />
          En progreso
        </span>
      );
    case "PENDING":
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
          <Clock className="size-3" />
          Pendiente
        </span>
      );
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VetCheckRow({ check }: { check: ManagementVetCheck }) {
  return (
    <tr className="border-b border-slate-100 last:border-0 text-sm hover:bg-slate-50/40 transition-colors">
      <td className="py-3 pl-4 pr-2 font-semibold text-slate-800 tabular-nums w-12">{check.trackPosition}</td>
      <td className="py-3 pr-3 font-medium text-slate-900">{check.riderName}</td>
      <td className="py-3 pr-3">
        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/40">
          {check.registrationNumber}
        </span>
      </td>
      <td className="py-3 pr-4 text-right">
        <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium", vetStatusBadgeClass(check.status))}>
          {vetStatusIcon(check.status)}
          {vetStatusLabel(check.status)}
        </span>
      </td>
    </tr>
  );
}

function JudgeFormRow({
  form,
  judgingStartedAt
}: {
  form: ManagementJudgeForm;
  judgingStartedAt: string | null;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200/60 bg-slate-50/30 p-4 transition-colors hover:border-slate-300/80 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border border-slate-200/40">
            Juez
          </span>
          <p className="truncate text-sm font-semibold text-slate-800">{form.judgeName}</p>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {form.status === "CLOSED" && form.closedAt && (
            <>
              <span className="flex items-center gap-1">
                <Clock className="size-3 text-slate-400" />
                {formatRoundFormTime(form.closedAt)}
              </span>
              {formatFaFormDuration(form, { judgingStartedAt }) && (
                <span className="inline-flex items-center gap-1 rounded border border-slate-200/40 bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                  <Timer className="size-3" />
                  {formatFaFormDuration(form, { judgingStartedAt })}
                </span>
              )}
            </>
          )}
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 border border-slate-200/30">
            {form.selectedCount} selecciones
          </span>
          {form.disqualifiedCount > 0 && (
            <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-600 border border-red-100/40">
              {form.disqualifiedCount} descalificados
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 self-start sm:self-center">{judgeStatusBadge(form.status)}</div>
    </div>
  );
}

// ─── PreRingSection ───────────────────────────────────────────────────────────

function PreRingSection({
  management,
}: {
  management: ManagementState;
}) {
  const [showAll, setShowAll] = useState(false);
  const { veterinaryChecks, summary } = management;
  const approved = veterinaryChecks.filter((c) => c.status === "APPROVED");
  const displayed = showAll ? veterinaryChecks : approved;
  const hasOthers = veterinaryChecks.length > approved.length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-3 bg-slate-50/80 border-b border-slate-200/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope className="size-4.5 text-slate-600" />
          <span className="text-base font-semibold text-slate-800">Pre-pista</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
          {summary.preRingClosedAt && (
            <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-200/40 text-slate-700">
              <span className="size-1.5 rounded-full bg-slate-400" />
              Cerrada: <strong>{formatDate(summary.preRingClosedAt)}</strong>
            </span>
          )}
          <span className="flex items-center gap-2 bg-slate-100/60 px-2.5 py-1 rounded border border-slate-200/20">
            <span><strong className="text-emerald-700 font-semibold">{summary.veterinary.approved}</strong> aprobados</span>
            <span className="text-slate-300">|</span>
            <span><strong className="text-red-600 font-semibold">{summary.veterinary.rejected}</strong> rechazados</span>
            <span className="text-slate-300">|</span>
            <span><strong className="text-slate-600 font-semibold">{summary.veterinary.absent}</strong> ausentes</span>
          </span>
        </div>
      </div>

      {/* Table */}
      {displayed.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50/40 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pl-4 pr-2 w-12">#</th>
                <th className="py-2.5 pr-3">Jinete</th>
                <th className="py-2.5 pr-3">Registro</th>
                <th className="py-2.5 pr-4 text-right">Estado</th>
              </tr>
            </thead>
            <tbody>
              {displayed
                .sort((a, b) => a.trackPosition - b.trackPosition)
                .map((check) => (
                  <VetCheckRow key={check.id} check={check} />
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-slate-400 text-center bg-white">Sin ejemplares aprobados.</p>
      )}

      {/* Toggle all */}
      {hasOthers && (
        <button
          className="flex w-full items-center justify-center gap-1.5 border-t border-slate-100 bg-slate-50/50 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100/80 transition-colors"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? (
            <>
              <ChevronUp className="size-3.5" />
              Mostrar solo aprobados
            </>
          ) : (
            <>
              <ChevronDown className="size-3.5" />
              Ver todos ({veterinaryChecks.length})
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ─── FaSection ────────────────────────────────────────────────────────────────

function FaSection({
  management,
  busy = false,
  onConsolidateFa,
}: {
  management: ManagementState;
  busy?: boolean;
  onConsolidateFa?: () => void;
}) {
  const { judgeForms, participants, consolidated, summary } = management;
  const { closedForms, totalJudges } = summary.judging;
  const disqualifiedParticipants = participants.filter((p) => p.status === "DISQUALIFIED");
  const isConsolidated = isFaStageComplete(summary.status) || consolidated.length > 0;
  const [showDetail, setShowDetail] = useState(false);

  const canConsolidateFa =
    summary.status === "JUDGING_STARTED" &&
    totalJudges > 0 &&
    closedForms >= totalJudges;

  if (showDetail && isConsolidated) {
    return (
      <FaConsolidatedDetail
        judgeForms={judgeForms}
        consolidated={consolidated}
        judgingStartedAt={summary.judgingStartedAt}
        onBack={() => setShowDetail(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-3 bg-slate-50/80 border-b border-slate-200/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="size-4.5 text-slate-600" />
          <span className="text-base font-semibold text-slate-800">Formato FA</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded border border-slate-200/40 text-slate-700">
            Jueces cerrados: <strong className="font-semibold">{closedForms}/{totalJudges}</strong>
          </span>
          <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded border border-slate-200/40 text-slate-700">
            Seleccionados: <strong className="font-semibold text-slate-800">{summary.judging.selected}</strong>
          </span>
          {summary.judging.disqualified > 0 && (
            <span className="flex items-center gap-1.5 bg-red-50 px-2 py-1 rounded border border-red-100/40 text-red-700 font-medium">
              Descalificados: <strong className="font-semibold">{summary.judging.disqualified}</strong>
            </span>
          )}
          {isConsolidated && (
            <button
              type="button"
              onClick={() => setShowDetail((current) => !current)}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              <Eye className="size-3.5" />
              {showDetail ? "Ocultar FA" : "Ver FA"}
            </button>
          )}
          {!isConsolidated && onConsolidateFa && (
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-amber-500 px-3 text-xs font-semibold text-white hover:bg-amber-600 disabled:bg-amber-500/50"
              disabled={busy || !canConsolidateFa}
              onClick={onConsolidateFa}
            >
              <CheckCheck className="size-3.5" />
              Consolidar FA
            </Button>
          )}
        </div>
      </div>

      {/* Judge rows */}
      <div className="space-y-2.5 p-5">
        {judgeForms.length === 0 ? (
          <p className="rounded-lg border border-slate-100 bg-slate-50/30 px-4 py-4 text-sm text-slate-400 text-center">
            Sin formatos FA registrados.
          </p>
        ) : (
          judgeForms
            .sort((a, b) => a.judgeName.localeCompare(b.judgeName))
            .map((form) => (
              <JudgeFormRow key={form.id} form={form} judgingStartedAt={summary.judgingStartedAt} />
            ))
        )}
      </div>

      {/* Disqualified participants */}
      {disqualifiedParticipants.length > 0 && (
        <div className="border-t border-slate-200/60 bg-slate-50/40 px-5 py-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
            <UserX className="size-4 text-slate-500" />
            Descalificados del FA ({disqualifiedParticipants.length})
          </div>
          <ul className="mt-3 space-y-2">
            {disqualifiedParticipants
              .sort((a, b) => a.trackPosition - b.trackPosition)
              .map((p) => (
                <li key={p.id} className="flex flex-col gap-1 rounded-md border border-slate-200/40 bg-white p-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-800">
                    <span className="font-bold text-slate-500 tabular-nums">#{p.trackPosition}</span>
                    <span className="font-medium">{p.riderName}</span>
                    <span className="font-mono text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {p.registrationNumber}
                    </span>
                  </div>
                  {p.disqualificationReason && (
                    <span className="inline-flex items-center rounded bg-red-50 border border-red-100/40 px-2 py-0.5 text-xs font-medium text-red-700 self-start sm:self-auto">
                      {p.disqualificationReason}
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
      </div>

    </div>
  );
}

// ─── ManagementView ───────────────────────────────────────────────────────────

export function ManagementView({
  management,
  rounds = [],
  busy = false,
  onConsolidateFa,
  onActivateRound,
}: {
  management: ManagementState;
  rounds?: RoundManagementItem[];
  busy?: boolean;
  onConsolidateFa?: () => void;
  onActivateRound?: (config: ActivateRoundConfig) => void;
}) {
  const f1Round = [...rounds].reverse().find((round) => round.roundType === "F1") ?? null;
  const activateRoundConfig = resolveActivateRoundConfig({
    status: management.summary.status,
    consolidatedCount: management.consolidated.length,
    f1ResultCount: f1Round?.results.length ?? 0,
  });

  return (
    <div className="space-y-5">
      <PreRingSection management={management} />
      <FaSection management={management} busy={busy} onConsolidateFa={onConsolidateFa} />
      {activateRoundConfig && onActivateRound && (
        <ActivateRoundCard
          config={activateRoundConfig}
          busy={busy}
          onActivate={() => onActivateRound(activateRoundConfig)}
        />
      )}
      <RoundsSummarySection rounds={rounds} />
    </div>
  );
}
