"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCheck, Gavel, Lock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { NotificationInbox } from "@/components/notification-inbox";
import { stagedFlowService } from "@/services/staged-flow.service";
import { useToast } from "@/components/ui/toast";
import { useVeterinaryChecks } from "@/hooks/use-veterinary-checks";
import { ContentReveal, PageLoader } from "@/components/loaders";
import { SummaryHeader } from "./_components/summary-header";
import { VetCheckCard } from "./_components/vet-check-card";
import { FaParticipantCard } from "./_components/fa-participant-card";
import { FaClosedState } from "./_components/fa-closed-state";
import { ManagementView } from "./_components/management-view";
import { JudgeRoundWorkspace } from "./_components/judge-round-workspace";
import { DirectorRounds } from "./_components/director-rounds";
import type {
  FaState,
  ManagementState,
  RoundState,
  RoundsManagement,
  StagedCategory,
  TieBreakTestType,
} from "@/types/staged-flow";

const JUDGE_ROUND_STATUSES: StagedCategory["status"][] = [
  "F1_IN_PROGRESS",
  "F1_CONSOLIDATED",
  "F2_IN_PROGRESS",
  "TIE_BREAK_IN_PROGRESS",
  "JUDGING_CLOSED",
];

// ─── Types ────────────────────────────────────────────────────────────────────

type CurrentUser = {
  role: string;
  roleLabel: string;
  personName: string | null;
};

function extractSelectedParticipantIds(state: FaState): string[] {
  return state.participants
    .filter((participant) => participant.decision?.decision === "SELECTED")
    .map((participant) => participant.id);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StaffCategoryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const stageId = params.id;

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [summary, setSummary] = useState<StagedCategory | null>(null);
  const [fa, setFa] = useState<FaState | null>(null);
  const [faSelectedIdsLocal, setFaSelectedIdsLocal] = useState<string[]>([]);
  const [management, setManagement] = useState<ManagementState | null>(null);
  const [round, setRound] = useState<RoundState | null>(null);
  const [roundsManagement, setRoundsManagement] = useState<RoundsManagement | null>(null);
  const [reasonByParticipantId, setReasonByParticipantId] = useState<Record<string, string>>({});
  const [disqualifyExpandedIds, setDisqualifyExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Ref síncrona: fuente de verdad para calcular el siguiente toggle sin depender del ciclo de React.
  const localSelectionRef = useRef<string[]>([]);
  const isSyncingFaSelectionRef = useRef(false);
  const pendingFaSelectionRef = useRef<string[] | null>(null);
  const latestConfirmedFaSelectionRef = useRef<string[]>([]);
  const latestFaRequestIdRef = useRef(0);
  const { toast } = useToast();

  const { checks, setChecks, updatingVetByEntryId, handleVetCheckUpdate } = useVeterinaryChecks({
    stageId,
    onUpdateError: () => {
      toast({
        title: "Error al guardar",
        description: "El cambio no fue registrado. Intenta nuevamente.",
        variant: "error",
      });
    },
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description?: string;
    variant?: "default" | "destructive";
    action: () => Promise<unknown>;
  } | null>(null);

  // ─── Data loading ─────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch user y categorías en paralelo — eliminamos la waterfall de requests.
      const [userResponse, categories] = await Promise.all([
        fetch("/api/auth/me"),
        stagedFlowService.listCategories(),
      ]);

      if (!userResponse.ok) throw new Error("No autorizado");
      const userPayload = (await userResponse.json()) as { data?: CurrentUser };
      const user = userPayload.data ?? null;
      setCurrentUser(user);

      const current = categories.data?.find((item) => item.stageId === stageId) ?? null;
      if (!current) {
        router.push("/staff");
        return;
      }
      setSummary(current);

      if (user?.role === "VETERINARIAN") {
        const response = await stagedFlowService.listVeterinaryChecks(stageId);
        setChecks(response.data ?? []);
      } else if (user?.role === "JUDGE") {
        if (current?.status === "JUDGING_STARTED") {
          const response = await stagedFlowService.getFa(stageId);
          setFa(response.data ?? null);
          setRound(null);
        } else if (current && JUDGE_ROUND_STATUSES.includes(current.status)) {
          const response = await stagedFlowService.getRound(stageId);
          setRound(response.data ?? null);
          setFa(null);
        } else {
          // FA consolidado o fases sin tarjeta de juez: solo lectura del resumen.
          setFa(null);
          setRound(null);
        }
      } else if (user?.role === "TECHNICAL_DIRECTOR") {
        const [managementResponse, roundsResponse] = await Promise.all([
          stagedFlowService.getManagement(stageId),
          stagedFlowService.getRoundsManagement(stageId),
        ]);
        setManagement(managementResponse.data ?? null);
        setRoundsManagement(roundsResponse.data ?? null);
      }
    } catch {
      router.push("/login/staff");
    } finally {
      setLoading(false);
    }
  }, [router, setChecks, stageId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ─── Confirm dialog helper ────────────────────────────────────────────────

  const runAction = (
    title: string,
    description: string,
    action: () => Promise<unknown>,
    variant: "default" | "destructive" = "default"
  ) => {
    setConfirmDialog({ open: true, title, description, action, variant });
  };

  // ─── FA handlers ─────────────────────────────────────────────────────────

  const selectedIds = useMemo(() => new Set(faSelectedIdsLocal), [faSelectedIdsLocal]);

  useEffect(() => {
    if (!fa) {
      localSelectionRef.current = [];
      setFaSelectedIdsLocal([]);
      latestConfirmedFaSelectionRef.current = [];
      pendingFaSelectionRef.current = null;
      isSyncingFaSelectionRef.current = false;
      return;
    }

    const confirmedSelectedIds = extractSelectedParticipantIds(fa);
    latestConfirmedFaSelectionRef.current = confirmedSelectedIds;

    // Evita que una respuesta tardía pise el estado optimista en curso.
    if (!isSyncingFaSelectionRef.current) {
      localSelectionRef.current = confirmedSelectedIds;
      setFaSelectedIdsLocal(confirmedSelectedIds);
    }
  }, [fa]);

  const flushFaSelection = useCallback(async () => {
    if (isSyncingFaSelectionRef.current) return;

    const queuedSelection = pendingFaSelectionRef.current;
    if (!queuedSelection) return;

    pendingFaSelectionRef.current = null;
    isSyncingFaSelectionRef.current = true;
    const requestId = ++latestFaRequestIdRef.current;

    try {
      const response = await stagedFlowService.updateFaDecisions(stageId, queuedSelection);
      if (requestId !== latestFaRequestIdRef.current) {
        return;
      }

      if (response.data) {
        const confirmedSelectedIds = extractSelectedParticipantIds(response.data);
        latestConfirmedFaSelectionRef.current = confirmedSelectedIds;
        // Solo sincroniza visualmente si no hay otra operación en cola.
        if (!pendingFaSelectionRef.current) {
          localSelectionRef.current = confirmedSelectedIds;
          setFaSelectedIdsLocal(confirmedSelectedIds);
        }
        setFa(response.data);
      }
    } catch (_error) {
      if (requestId === latestFaRequestIdRef.current) {
        localSelectionRef.current = latestConfirmedFaSelectionRef.current;
        setFaSelectedIdsLocal(latestConfirmedFaSelectionRef.current);
        toast({
          title: "No se pudo guardar la selección",
          description: "Se restauró la última selección confirmada. Intenta nuevamente.",
          variant: "error"
        });
      }
    } finally {
      isSyncingFaSelectionRef.current = false;
      if (pendingFaSelectionRef.current) {
        void flushFaSelection();
      }
    }
  }, [stageId, toast]);

  const toggleFaSelection = useCallback(
    (participantId: string) => {
      if (!fa || summary?.status !== "JUDGING_STARTED" || fa.form.status !== "STARTED") return;

      // Leer siempre desde la ref síncrona para evitar estado stale en taps rápidos.
      const current = localSelectionRef.current;
      const isSelected = current.includes(participantId);
      const next = isSelected
        ? current.filter((id) => id !== participantId)
        : [...current, participantId];

      if (next.length > 10) return;

      // Actualizar ref y estado visual de forma atómica y síncrona.
      localSelectionRef.current = next;
      setFaSelectedIdsLocal(next);

      // Cola de sincronización: si hay un request en vuelo, solo actualizamos el
      // payload pendiente; flushFaSelection lo enviará al terminar.
      pendingFaSelectionRef.current = next;
      void flushFaSelection();
    },
    [fa, flushFaSelection, summary?.status]
  );

  const toggleDisqualifyPanel = useCallback((participantId: string) => {
    setDisqualifyExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) {
        next.delete(participantId);
      } else {
        next.add(participantId);
      }
      return next;
    });
  }, []);

  const handleDisqualifyParticipant = useCallback(
    (participantId: string, reasonId: string) => {
      if (!fa || summary?.status !== "JUDGING_STARTED" || fa.form.status !== "STARTED") return;
      const reason = fa?.disqualificationReasons.find((r) => r.id === reasonId);
      if (!reason) return;
      runAction(
        "Confirmar descalificación",
        `Este ejemplar quedará fuera de la competencia por "${reason.name}" y no podrá ser seleccionado por otros jueces.`,
        () => stagedFlowService.disqualifyParticipant(stageId, participantId, reasonId),
        "destructive"
      );
    },
    [fa, stageId, summary?.status]
  );

  const handleOpenTieBreak = (testTypes: TieBreakTestType[]) => {
    runAction(
      "Abrir desempate",
      "Se abrirá una ronda de desempate solo para los ejemplares empatados. Los jueces volverán a emitir su tarjeta.",
      () => stagedFlowService.openTieBreak(stageId, testTypes)
    );
  };

  const showDirectorRounds =
    summary != null &&
    ([
      "FA_CONSOLIDATED",
      "F1_IN_PROGRESS",
      "F1_CONSOLIDATED",
      "F2_IN_PROGRESS",
      "TIE_BREAK_IN_PROGRESS",
      "JUDGING_DESERTED",
      "JUDGING_CLOSED"
    ] as StagedCategory["status"][]).includes(
      summary.status
    );

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading || !summary) {
    return <PageLoader label="Cargando categoría..." />;
  }

  return (
    <ContentReveal>
    <div className="min-h-screen bg-[#f5f7fb]">
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href="/staff" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
            <ArrowLeft className="size-4" />
            Volver
          </Link>
          <NotificationInbox />
        </div>

        <SummaryHeader summary={summary} />

        {/* ── DIRECTOR TÉCNICO ─────────────────────────────────────────── */}
        {currentUser?.role === "TECHNICAL_DIRECTOR" && (
          <section className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-950">Gestión</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Button
                size="lg"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-emerald-600/50"
                disabled={busy || summary.status !== "NOT_STARTED"}
                onClick={() =>
                  runAction(
                    "Iniciar pre-pista",
                    "Esto dará inicio a la revisión veterinaria de los ejemplares de esta categoría.",
                    () => stagedFlowService.startPreRing(stageId)
                  )
                }
              >
                <Play className="size-4" />
                Iniciar pre-pista
              </Button>
              <Button
                size="lg"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-600/50"
                disabled={busy || summary.status !== "PRE_RING_CLOSED"}
                onClick={() =>
                  runAction(
                    "Iniciar juzgamiento",
                    "Comenzará el juzgamiento con los ejemplares que fueron aprobados por el veterinario.",
                    () => stagedFlowService.startJudging(stageId)
                  )
                }
              >
                <Gavel className="size-4" />
                Iniciar juzgamiento
              </Button>
              <Button
                size="lg"
                className="w-full bg-amber-500 hover:bg-amber-600 text-white disabled:bg-amber-500/50"
                disabled={
                  busy ||
                  summary.status !== "JUDGING_STARTED" ||
                  summary.judging.closedForms < summary.judging.totalJudges
                }
                onClick={() =>
                  runAction(
                    "Consolidar FA",
                    "Esto consolidará los formatos cerrados de los jueces y dará por terminado el juzgamiento.",
                    () => stagedFlowService.consolidateFa(stageId)
                  )
                }
              >
                <CheckCheck className="size-4" />
                Consolidar FA
              </Button>
              <Button
                size="lg"
                className="w-full bg-slate-700 hover:bg-slate-800 text-white disabled:bg-slate-700/50"
                disabled={busy || summary.status === "JUDGING_CLOSED" || summary.status === "JUDGING_DESERTED"}
                onClick={() =>
                  runAction(
                    "Declarar competencia desierta",
                    "La categoría quedará cerrada sin ejemplares premiables. Esta acción es irreversible para el flujo actual.",
                    () => stagedFlowService.desertCompetition(stageId),
                    "destructive"
                  )
                }
              >
                <Lock className="size-4" />
                Declarar desierta
              </Button>
            </div>

            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-900">Reinicio para pruebas</p>
                  <p className="text-xs text-red-700">
                    Limpia checkeos, juzgamiento, FA, eventos y notificaciones de esta categoria.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      "Reiniciar flujo",
                      "La categoria volvera a Sin iniciar y se limpiaran checkeos, juzgamiento, FA, eventos y notificaciones de prueba.",
                      () => stagedFlowService.resetStageForTesting(stageId),
                      "destructive"
                    )
                  }
                >
                  Reiniciar flujo
                </Button>
              </div>
            </div>

            {showDirectorRounds && roundsManagement && (
              <DirectorRounds
                stageId={stageId}
                summary={summary}
                rounds={roundsManagement.rounds}
                busy={busy}
                runAction={runAction}
                onOpenTieBreak={handleOpenTieBreak}
              />
            )}

            {management && <ManagementView management={management} rounds={roundsManagement?.rounds ?? []} />}
          </section>
        )}

        {/* ── VETERINARIO ──────────────────────────────────────────────── */}
        {currentUser?.role === "VETERINARIAN" && (
          <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Checkeo veterinario</h2>
                {checks.length > 0 && (
                  <p className="mt-0.5 text-sm text-slate-500">
                    {checks.filter((c) => c.status !== "PENDING").length}/{checks.length} revisados
                  </p>
                )}
              </div>
              <Button
                disabled={
                  busy ||
                  summary.status !== "PRE_RING_STARTED" ||
                  checks.some((c) => c.status === "PENDING")
                }
                onClick={() =>
                  runAction(
                    "Cerrar pre-pista",
                    "Todos los participantes tienen decisión veterinaria. Solo los aprobados pasarán a juzgamiento.",
                    () => stagedFlowService.closePreRing(stageId)
                  )
                }
              >
                Cerrar pre-pista
              </Button>
            </div>
            <div className="mt-4 grid gap-3">
              {checks.map((check) => (
                <VetCheckCard
                  key={check.id}
                  check={check}
                  editable={summary.status === "PRE_RING_STARTED"}
                  isUpdating={Boolean(updatingVetByEntryId[check.fairEntryId])}
                  onUpdate={handleVetCheckUpdate}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── JUEZ ─────────────────────────────────────────────────────── */}
        {currentUser?.role === "JUDGE" && fa && (
          <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Formato FA</h2>
                <p className="text-sm text-slate-500">{fa.form.selectedCount} / 10 seleccionados</p>
              </div>
              {fa.form.status !== "CLOSED" && (
                <div className="flex gap-2">
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-emerald-600/50"
                    disabled={busy || summary.status !== "JUDGING_STARTED" || fa.form.status !== "PENDING"}
                    onClick={() =>
                      runAction(
                        "Iniciar Formato FA",
                        "Podrás empezar a seleccionar o descartar ejemplares en competencia.",
                        () => stagedFlowService.startFa(stageId)
                      )
                    }
                  >
                    <Play className="size-4" />
                    Iniciar FA
                  </Button>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-600/50"
                    disabled={
                      busy ||
                      summary.status !== "JUDGING_STARTED" ||
                      fa.form.status !== "STARTED"
                    }
                    onClick={() =>
                      runAction(
                        "Cerrar Formato FA",
                        "Una vez cerrado, no podrás modificar tus selecciones. Puedes cerrar con cero seleccionados si corresponde al criterio de juzgamiento.",
                        () => stagedFlowService.closeFa(stageId)
                      )
                    }
                  >
                    <Lock className="size-4" />
                    Cerrar FA
                  </Button>
                </div>
              )}
            </div>

            {fa.form.status === "CLOSED" && (
              <div className="mt-4">
                <FaClosedState
                  closedAt={fa.form.closedAt}
                  selectedCount={fa.form.selectedCount}
                  stageStatus={summary.status}
                />
              </div>
            )}

            {fa.form.status !== "PENDING" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {fa.participants.map((participant) => (
                  <FaParticipantCard
                    key={participant.id}
                    participant={participant}
                    selected={selectedIds.has(participant.id)}
                    editable={summary.status === "JUDGING_STARTED" && fa.form.status === "STARTED"}
                    disqualifyExpanded={disqualifyExpandedIds.has(participant.id)}
                    selectedReasonId={reasonByParticipantId[participant.id] ?? ""}
                    reasons={fa.disqualificationReasons}
                    onToggle={toggleFaSelection}
                    onExpandDisqualify={toggleDisqualifyPanel}
                    onReasonChange={(id, reasonId) =>
                      setReasonByParticipantId((prev) => ({ ...prev, [id]: reasonId }))
                    }
                    onDisqualify={handleDisqualifyParticipant}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── JUEZ: FA consolidado, esperando ronda ─────────────────────── */}
        {currentUser?.role === "JUDGE" && summary.status === "FA_CONSOLIDATED" && (
          <section className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-8 text-center">
            <p className="text-base font-semibold text-slate-900">FA consolidado</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              El Director Técnico está por abrir la siguiente ronda (F1 o F2). Espera la notificación.
            </p>
          </section>
        )}

        {currentUser?.role === "JUDGE" && summary.status === "JUDGING_DESERTED" && (
          <section className="mt-4 rounded-lg border border-slate-300 bg-white px-6 py-8 text-center">
            <p className="text-base font-semibold text-slate-900">Competencia desierta</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              El Director Técnico cerró esta categoría sin ejemplares premiables.
            </p>
          </section>
        )}

        {/* ── JUEZ: rondas F1 / F2 / desempate ──────────────────────────── */}
        {currentUser?.role === "JUDGE" && round && (
          <JudgeRoundWorkspace
            stageId={stageId}
            round={round}
            busy={busy}
            onLocalUpdate={setRound}
            runAction={runAction}
          />
        )}
      </main>

      {/* ── Confirm dialog ───────────────────────────────────────────────── */}
      {confirmDialog && (
        <ConfirmActionDialog
          open={confirmDialog.open}
          onOpenChange={(open) => {
            if (!open) setConfirmDialog(null);
          }}
          title={confirmDialog.title}
          description={confirmDialog.description}
          variant={confirmDialog.variant}
          busy={busy}
          onConfirm={async () => {
            setBusy(true);
            try {
              await confirmDialog.action();
              await load();
              toast({ title: "Acción completada", variant: "success" });
            } catch (error) {
              toast({
                title: "Error",
                description: error instanceof Error ? error.message : "No fue posible completar la acción.",
                variant: "error",
              });
            } finally {
              setBusy(false);
              setConfirmDialog(null);
            }
          }}
        />
      )}
    </div>
    </ContentReveal>
  );
}
