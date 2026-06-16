import type { ManagementJudgeForm, RoundManagementForm, RoundManagementItem } from "@/types/staged-flow";

export function formatRoundFormTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

export function formatFormDuration(startedAt: string | null, closedAt: string | null): string | null {
  if (!startedAt || !closedAt) return null;

  const ms = new Date(closedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 0) return null;

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function resolveFormStartedAt(
  form: RoundManagementForm,
  round: Pick<RoundManagementItem, "openedAt">
): string | null {
  return form.startedAt ?? round.openedAt ?? null;
}

export function resolveFaFormStartedAt(
  form: Pick<ManagementJudgeForm, "startedAt">,
  context: { judgingStartedAt: string | null }
): string | null {
  return form.startedAt ?? context.judgingStartedAt ?? null;
}

export function formatRoundFormDuration(
  form: RoundManagementForm,
  round: Pick<RoundManagementItem, "openedAt">
): string | null {
  return formatFormDuration(resolveFormStartedAt(form, round), form.closedAt);
}

export function formatFaFormDuration(
  form: Pick<ManagementJudgeForm, "startedAt" | "closedAt">,
  context: { judgingStartedAt: string | null }
): string | null {
  return formatFormDuration(resolveFaFormStartedAt(form, context), form.closedAt);
}
