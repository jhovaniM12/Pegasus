"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Gavel, Lock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { NotificationInbox } from "@/components/notification-inbox";
import { stagedFlowService } from "@/services/staged-flow.service";
import { useToast } from "@/components/ui/toast";
import { useStaffRealtimeRefresh } from "@/hooks/use-staff-realtime-refresh";
import { PushNotificationGate } from "@/components/push-notification-gate";
import { PushNotificationProvider } from "@/components/push-notification-provider";
import { useVeterinaryChecks } from "@/hooks/use-veterinary-checks";
import { ContentReveal, PageLoader } from "@/components/loaders";
import { ApiError, isUnauthorizedError } from "@/services/api.service";
import { SummaryHeader } from "./_components/summary-header";
import { VetCheckCard } from "./_components/vet-check-card";
import { FaParticipantCard } from "./_components/fa-participant-card";
import { FaActionsLegend } from "./_components/fa-actions-legend";
import { FaDisqualifyDialog } from "./_components/fa-disqualify-dialog";
import { FaRepeatTrackDialog } from "./_components/fa-repeat-track-dialog";
import { FaClosedState } from "./_components/fa-closed-state";
import { FaConsolidatedBanner } from "./_components/fa-consolidated-banner";
import { ManagementView } from "./_components/management-view";
import { JudgeRoundWorkspace } from "./_components/judge-round-workspace";
import { DirectorRounds } from "./_components/director-rounds";
import { OfficialResultBoard } from "./_components/official-result-board";
import { buildOfficialF2Results } from "./_components/official-f2-results";
import { ClosePreRingDialog } from "./_components/close-pre-ring-dialog";
import { StartFaDialog } from "./_components/start-fa-dialog";
import { CloseFaDialog } from "./_components/close-fa-dialog";
import { ConsolidateFaDialog } from "./_components/consolidate-fa-dialog";
import { ActivateRoundDialog } from "./_components/activate-round-dialog";
import type { ActivateRoundConfig } from "./_components/activate-round-card";
import type {
  FaState,
  FaParticipant,
  JudgeFormatKey,
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

const ROUND_VIEW_KEYS: JudgeFormatKey[] = ["F1", "F2", "TIE_BREAK"];

function isRoundView(view: string | null): view is "F1" | "F2" | "TIE_BREAK" {
  return view != null && ROUND_VIEW_KEYS.includes(view as JudgeFormatKey);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CurrentUser = {
  id: string;
  role: string;
  roleLabel: string;
  personName: string | null;
};

function extractSelectedParticipantIds(state: FaState): string[] {
  return state.participants
    .filter((participant) => participant.decision?.decision === "SELECTED")
    .map((participant) => participant.id);
}

function resolveJudgeView(viewParam: string | null): "FA" | "F1" | "F2" | "TIE_BREAK" | null {
  if (viewParam === "FA") return "FA";
  return isRoundView(viewParam) ? viewParam : null;
}

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const response = await fetch("/api/auth/me");
  if (response.status === 401) {
    throw new ApiError("Sesión expirada. Vuelve a ingresar.", {
      status: 401,
      code: "UNAUTHORIZED",
    });
  }
  if (!response.ok) return null;
  const payload = (await response.json()) as { data?: CurrentUser };
  return payload.data ?? null;
}

async function loadJudgeWorkspace(
  stageId: string,
  current: StagedCategory,
  viewParam: string | null
): Promise<{
  summary: StagedCategory;
  fa: FaState | null;
  round: RoundState | null;
  roundsManagement: RoundsManagement | null;
}> {
  const view = resolveJudgeView(viewParam);
  const judgeHasClosedFa = current.judge?.faFormStatus === "CLOSED";

  if (view === "FA") {
    const response = await stagedFlowService.getFa(stageId);
    const fa = response.data ?? null;
    return { summary: fa?.stage ?? current, fa, round: null, roundsManagement: null };
  }

  if (view != null) {
    const response = await stagedFlowService.getRoundByType(stageId, view);
    const round = response.data ?? null;
    return { summary: round?.stage ?? current, fa: null, round, roundsManagement: null };
  }

  if (current.status === "JUDGING_CLOSED") {
    const response = await stagedFlowService.getRoundsManagement(stageId);
    const roundsManagement = response.data ?? null;
    return {
      summary: roundsManagement?.stage ?? current,
      fa: null,
      round: null,
      roundsManagement,
    };
  }

  if (current.status === "JUDGING_STARTED") {
    const response = await stagedFlowService.getFa(stageId);
    const fa = response.data ?? null;
    return { summary: fa?.stage ?? current, fa, round: null, roundsManagement: null };
  }

  if (judgeHasClosedFa && current.status === "FA_CONSOLIDATED") {
    const response = await stagedFlowService.getFa(stageId);
    const fa = response.data ?? null;
    return { summary: fa?.stage ?? current, fa, round: null, roundsManagement: null };
  }

  if (JUDGE_ROUND_STATUSES.includes(current.status)) {
    const response = await stagedFlowService.getRound(stageId);
    const round = response.data ?? null;
    return { summary: round?.stage ?? current, fa: null, round, roundsManagement: null };
  }

  if (judgeHasClosedFa) {
    const response = await stagedFlowService.getFa(stageId);
    const fa = response.data ?? null;
    return { summary: fa?.stage ?? current, fa, round: null, roundsManagement: null };
  }

  return { summary: current, fa: null, round: null, roundsManagement: null };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StaffCategoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const stageId = params.id;
  const viewParam = searchParams.get("view");

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [summary, setSummary] = useState<StagedCategory | null>(null);
  const [fa, setFa] = useState<FaState | null>(null);
  const [faSelectedIdsLocal, setFaSelectedIdsLocal] = useState<string[]>([]);
  const [management, setManagement] = useState<ManagementState | null>(null);
  const [round, setRound] = useState<RoundState | null>(null);
  const [roundsManagement, setRoundsManagement] = useState<RoundsManagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [disqualifyTarget, setDisqualifyTarget] = useState<FaParticipant | null>(null);
  const [disqualifyBusy, setDisqualifyBusy] = useState(false);
  const [repeatTrackTarget, setRepeatTrackTarget] = useState<FaParticipant | null>(null);
  const [repeatTrackBusy, setRepeatTrackBusy] = useState(false);
  // Ref síncrona: fuente de verdad para calcular el siguiente toggle sin depender del ciclo de React.
  const localSelectionRef = useRef<string[]>([]);
  const sessionExpiredRef = useRef(false);
  const isSyncingFaSelectionRef = useRef(false);
  const pendingFaSelectionRef = useRef<string[] | null>(null);
  const latestConfirmedFaSelectionRef = useRef<string[]>([]);
  const latestFaRequestIdRef = useRef(0);
  const { toast } = useToast();

  const staffLoginPath = useCallback(() => {
    const next =
      typeof window === "undefined"
        ? `/staff/categories/${stageId}`
        : `${window.location.pathname}${window.location.search}`;
    return `/login/staff?next=${encodeURIComponent(next)}`;
  }, [stageId]);

  const markSessionExpired = useCallback(() => {
    if (!sessionExpiredRef.current) {
      toast({
        title: "Sesión expirada",
        description: "Vuelve a ingresar para seguir recibiendo datos actualizados.",
        variant: "error",
      });
    }
    sessionExpiredRef.current = true;
    setSessionExpired(true);
  }, [toast]);

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
    confirmText?: string;
    variant?: "default" | "destructive";
    action: () => Promise<unknown>;
    redirectTo?: string;
  } | null>(null);
  const [closePreRingOpen, setClosePreRingOpen] = useState(false);
  const [startFaOpen, setStartFaOpen] = useState(false);
  const [closeFaOpen, setCloseFaOpen] = useState(false);
  const [consolidateFaOpen, setConsolidateFaOpen] = useState(false);
  const [activateRoundTarget, setActivateRoundTarget] = useState<ActivateRoundConfig | null>(null);

  // ─── Data loading ─────────────────────────────────────────────────────────

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!stageId) return;

    if (!silent) {
      setLoading(true);
    }
    try {
      const judgeView = resolveJudgeView(viewParam);

      if (judgeView === "FA") {
        const [user, faResponse] = await Promise.all([
          fetchCurrentUser(),
          stagedFlowService.getFa(stageId),
        ]);

        if (!user) {
          if (!silent) router.push(staffLoginPath());
          return;
        }

        sessionExpiredRef.current = false;
        setSessionExpired(false);
        setCurrentUser(user);
        const faData = faResponse.data ?? null;
        const summaryData = faData?.stage ?? null;

        if (!summaryData) {
          if (!silent) {
            toast({
              title: "Categoría no disponible",
              description: "No tienes acceso a esta categoría o no existe.",
              variant: "error",
            });
            router.push("/staff");
          }
          return;
        }

        setSummary(summaryData);
        setFa(faData);
        setRound(null);
        setRoundsManagement(null);
        return;
      }

      if (judgeView != null) {
        const [user, roundResponse] = await Promise.all([
          fetchCurrentUser(),
          stagedFlowService.getRoundByType(stageId, judgeView),
        ]);

        if (!user) {
          if (!silent) router.push(staffLoginPath());
          return;
        }

        sessionExpiredRef.current = false;
        setSessionExpired(false);
        setCurrentUser(user);
        const roundData = roundResponse.data ?? null;
        const summaryData = roundData?.stage ?? null;

        if (!summaryData) {
          if (!silent) {
            toast({
              title: "Categoría no disponible",
              description: "No tienes acceso a esta categoría o no existe.",
              variant: "error",
            });
            router.push("/staff");
          }
          return;
        }

        setSummary(summaryData);
        setFa(null);
        setRound(roundData);
        setRoundsManagement(null);
        return;
      }

      const user = await fetchCurrentUser();
      if (!user) {
        if (!silent) router.push(staffLoginPath());
        return;
      }

      sessionExpiredRef.current = false;
      setSessionExpired(false);
      setCurrentUser(user);

      if (user.role === "TECHNICAL_DIRECTOR") {
        const [managementResult, roundsResult] = await Promise.allSettled([
          stagedFlowService.getManagement(stageId),
          stagedFlowService.getRoundsManagement(stageId),
        ]);

        if (managementResult.status === "rejected") {
          throw managementResult.reason;
        }

        let roundsData: RoundsManagement | null = null;
        if (roundsResult.status === "fulfilled") {
          roundsData = roundsResult.value.data ?? null;
        } else if (!silent) {
          toast({
            title: "No se pudieron cargar las rondas F1/F2",
            description:
              roundsResult.reason instanceof Error
                ? roundsResult.reason.message
                : "Recarga la página para reintentar.",
            variant: "error",
          });
        }

        const management = managementResult.value.data ?? null;
        if (!management?.summary) {
          if (!silent) {
            toast({
              title: "Categoría no disponible",
              description: "No tienes acceso a esta categoría o no existe.",
              variant: "error",
            });
            router.push("/staff");
          }
          return;
        }

        setSummary(management.summary);
        setManagement(management);
        setRoundsManagement(roundsData);
        setFa(null);
        setRound(null);
        return;
      }

      if (user.role === "VETERINARIAN") {
        const [categoryResponse, checksResponse] = await Promise.all([
          stagedFlowService.getCategory(stageId),
          stagedFlowService.listVeterinaryChecks(stageId),
        ]);
        const current = categoryResponse.data ?? null;
        if (!current) {
          if (!silent) {
            toast({
              title: "Categoría no disponible",
              description: "No tienes acceso a esta categoría o no existe.",
              variant: "error",
            });
            router.push("/staff");
          }
          return;
        }

        setSummary(current);
        setChecks(checksResponse.data ?? []);
        setFa(null);
        setRound(null);
        setRoundsManagement(null);
        return;
      }

      const categoryResponse = await stagedFlowService.getCategory(stageId);
      const current = categoryResponse.data ?? null;
      if (!current) {
        if (!silent) {
          toast({
            title: "Categoría no disponible",
            description: "No tienes acceso a esta categoría o no existe.",
            variant: "error",
          });
          router.push("/staff");
        }
        return;
      }

      setSummary(current);

      if (user.role === "JUDGE") {
        const workspace = await loadJudgeWorkspace(stageId, current, viewParam);
        setSummary(workspace.summary);
        setFa(workspace.fa);
        setRound(workspace.round);
        setRoundsManagement(workspace.roundsManagement);
      }
    } catch (error) {
      if (isUnauthorizedError(error)) {
        markSessionExpired();
        if (!silent) {
          router.push(staffLoginPath());
        }
        return;
      }

      if (!silent) {
        toast({
          title: "Error al cargar la categoría",
          description: error instanceof Error ? error.message : "Intenta nuevamente.",
          variant: "error",
        });
        router.push("/staff");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [markSessionExpired, router, setChecks, staffLoginPath, stageId, toast, viewParam]);

  useEffect(() => {
    const handleUnauthorized = () => {
      markSessionExpired();
    };

    window.addEventListener("pegasus:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("pegasus:unauthorized", handleUnauthorized);
    };
  }, [markSessionExpired]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch remoto al montar o cambiar contexto
    void load();
  }, [load]);

  useStaffRealtimeRefresh(
    () => load({ silent: true }),
    {
      enableVisibilityRefresh: true,
      refreshWhenHidden: true,
      pollingMs: 10_000,
      debounceMs: 0,
    }
  );

  // ─── Confirm dialog helper ────────────────────────────────────────────────

  const runAction = (
    title: string,
    description: string,
    action: () => Promise<unknown>,
    variant: "default" | "destructive" = "default",
    confirmText?: string,
    redirectTo?: string
  ) => {
    setConfirmDialog({ open: true, title, description, action, variant, confirmText, redirectTo });
  };

  // ─── FA handlers ─────────────────────────────────────────────────────────

  const selectedIds = useMemo(() => new Set(faSelectedIdsLocal), [faSelectedIdsLocal]);
  const faSelectedCount = useMemo(() => {
    if (!fa) return 0;
    return fa.form.status === "STARTED" ? selectedIds.size : fa.form.selectedCount;
  }, [fa, selectedIds]);

  useEffect(() => {
    if (!fa) {
      localSelectionRef.current = [];
      latestConfirmedFaSelectionRef.current = [];
      pendingFaSelectionRef.current = null;
      isSyncingFaSelectionRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset al salir de vista FA
      setFaSelectedIdsLocal([]);
      return;
    }

    const confirmedSelectedIds = extractSelectedParticipantIds(fa);
    latestConfirmedFaSelectionRef.current = confirmedSelectedIds;

    if (!isSyncingFaSelectionRef.current) {
      localSelectionRef.current = confirmedSelectedIds;
      setFaSelectedIdsLocal(confirmedSelectedIds);
    }
  }, [fa]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- cola optimista con refs estables
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
    } catch {
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

  const openFaDisqualify = useCallback(
    (participantId: string) => {
      if (!fa || summary?.status !== "JUDGING_STARTED" || fa.form.status !== "STARTED") return;
      const participant = fa.participants.find((item) => item.id === participantId) ?? null;
      if (!participant || participant.status === "DISQUALIFIED") return;
      setDisqualifyTarget(participant);
    },
    [fa, summary?.status]
  );

  const confirmFaDisqualify = useCallback(
    async (participantId: string, reasonId: string) => {
      if (!fa || summary?.status !== "JUDGING_STARTED" || fa.form.status !== "STARTED") return;

      setDisqualifyBusy(true);
      try {
        const response = await stagedFlowService.disqualifyParticipant(stageId, participantId, reasonId);
        if (response.data) {
          setFa(response.data);
          setSummary(response.data.stage);
          const confirmedSelectedIds = extractSelectedParticipantIds(response.data);
          latestConfirmedFaSelectionRef.current = confirmedSelectedIds;
          localSelectionRef.current = confirmedSelectedIds;
          setFaSelectedIdsLocal(confirmedSelectedIds);
          setDisqualifyTarget(null);
          toast({ title: "Ejemplar descalificado", variant: "success" });
        }
      } catch (error) {
        toast({
          title: "No se pudo descalificar",
          description: error instanceof Error ? error.message : "Intenta nuevamente.",
          variant: "error",
        });
        throw error;
      } finally {
        setDisqualifyBusy(false);
      }
    },
    [fa, stageId, summary?.status, toast]
  );

  const openFaRepeatTrack = useCallback(
    (participantId: string) => {
      if (!fa || summary?.status !== "JUDGING_STARTED" || fa.form.status !== "STARTED") return;
      const participant = fa.participants.find((item) => item.id === participantId) ?? null;
      if (!participant || participant.status === "DISQUALIFIED" || participant.repeatTrackRequest) return;
      setRepeatTrackTarget(participant);
    },
    [fa, summary?.status]
  );

  const confirmFaRepeatTrack = useCallback(
    async (participantId: string) => {
      if (!fa || summary?.status !== "JUDGING_STARTED" || fa.form.status !== "STARTED") return;

      setRepeatTrackBusy(true);
      try {
        const response = await stagedFlowService.requestFaRepeatTrack(stageId, participantId);
        if (response.data) {
          setFa(response.data);
          setSummary(response.data.stage);
          const confirmedSelectedIds = extractSelectedParticipantIds(response.data);
          latestConfirmedFaSelectionRef.current = confirmedSelectedIds;
          localSelectionRef.current = confirmedSelectedIds;
          setFaSelectedIdsLocal(confirmedSelectedIds);
          setRepeatTrackTarget(null);
          toast({ title: "Solicitud enviada", variant: "success" });
        }
      } catch (error) {
        toast({
          title: "No se pudo enviar la solicitud",
          description: error instanceof Error ? error.message : "Intenta nuevamente.",
          variant: "error",
        });
        throw error;
      } finally {
        setRepeatTrackBusy(false);
      }
    },
    [fa, stageId, summary?.status, toast]
  );

  const executeFaRepeatTrack = useCallback(
    async (requestId: string) => {
      setBusy(true);
      try {
        const response = await stagedFlowService.executeFaRepeatTrackRequest(stageId, requestId);
        if (response.data) {
          setManagement(response.data);
          setSummary(response.data.summary);
        }
        toast({ title: "Solicitud marcada como ejecutada", variant: "success" });
      } catch (error) {
        toast({
          title: "No se pudo marcar ejecutada",
          description: error instanceof Error ? error.message : "Intenta nuevamente.",
          variant: "error",
        });
      } finally {
        setBusy(false);
      }
    },
    [stageId, toast]
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
  const judgeOfficialF2 = roundsManagement ? buildOfficialF2Results(roundsManagement.rounds) : null;

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading || !summary) {
    return (
      <PushNotificationProvider userId={currentUser?.id}>
        <PageLoader label="Cargando categoría..." />
        <PushNotificationGate />
      </PushNotificationProvider>
    );
  }

  return (
    <PushNotificationProvider userId={currentUser?.id}>
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

        {sessionExpired && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Sesión expirada</p>
                <p>Los datos de esta pantalla pueden estar desactualizados. Vuelve a ingresar para continuar.</p>
              </div>
              <Button
                type="button"
                size="sm"
                className="shrink-0 bg-red-600 text-white hover:bg-red-700"
                onClick={() => router.push(staffLoginPath())}
              >
                Ingresar
              </Button>
            </div>
          </div>
        )}

        {currentUser?.role === "TECHNICAL_DIRECTOR" && (
          <SummaryHeader summary={summary} />
        )}

        {/* ── DIRECTOR TÉCNICO ─────────────────────────────────────────── */}
        {currentUser?.role === "TECHNICAL_DIRECTOR" && (
          <section className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-950">Gestión</h2>
            <div className="grid gap-3 sm:grid-cols-2">
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

            {management && (
              <ManagementView
                management={management}
                rounds={roundsManagement?.rounds ?? []}
                busy={busy}
                onConsolidateFa={() => setConsolidateFaOpen(true)}
                onActivateRound={(config) => setActivateRoundTarget(config)}
                onExecuteRepeatTrack={executeFaRepeatTrack}
              />
            )}

            {showDirectorRounds && (
              <DirectorRounds
                stageId={stageId}
                summary={summary}
                rounds={roundsManagement?.rounds ?? []}
                busy={busy}
                runAction={runAction}
                onOpenTieBreak={handleOpenTieBreak}
              />
            )}
          </section>
        )}

        {/* ── VETERINARIO ──────────────────────────────────────────────── */}
        {currentUser?.role === "VETERINARIAN" && (
          <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Checkeo veterinario</h2>
              {checks.length > 0 && (
                <p className="mt-0.5 text-sm text-slate-500">
                  {checks.filter((c) => c.status !== "PENDING").length}/{checks.length} revisados
                </p>
              )}
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
            <Button
              size="lg"
              className="mt-5 h-14 w-full gap-2 rounded-xl px-6 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-600/50"
              disabled={
                busy ||
                summary.status !== "PRE_RING_STARTED" ||
                checks.some((c) => c.status === "PENDING")
              }
              onClick={() => setClosePreRingOpen(true)}
            >
              <Lock className="size-5" />
              Cerrar pre-pista
            </Button>
          </section>
        )}

        {/* ── JUEZ ─────────────────────────────────────────────────────── */}
        {currentUser?.role === "JUDGE" && fa && (
          <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Formato FA</h2>
                <p className="text-sm text-slate-500">{faSelectedCount} / 10 seleccionados</p>
              </div>
              {fa.form.status !== "CLOSED" && (
                <div className="flex gap-2">
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-emerald-600/50"
                    disabled={busy || summary.status !== "JUDGING_STARTED" || fa.form.status !== "PENDING"}
                    onClick={() => setStartFaOpen(true)}
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
                    onClick={() => setCloseFaOpen(true)}
                  >
                    <Lock className="size-4" />
                    Cerrar FA
                  </Button>
                </div>
              )}
            </div>

            {(fa.consolidated ?? []).length > 0 && (
              <div className="mt-4">
                <FaConsolidatedBanner consolidated={fa.consolidated ?? []} />
              </div>
            )}

            {fa.form.status === "CLOSED" && (
              <div className="mt-4">
                <FaClosedState
                  closedAt={fa.form.closedAt}
                  selectedCount={fa.form.selectedCount}
                  stageStatus={summary.status}
                  syncUnavailable={sessionExpired}
                  hideConsolidatedNotice={(fa.consolidated ?? []).length > 0}
                />
              </div>
            )}

            {fa.form.status !== "PENDING" && (
              <div className="mt-4 space-y-3">
                <FaActionsLegend />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {fa.participants.map((participant) => (
                    <FaParticipantCard
                      key={participant.id}
                      participant={participant}
                      selected={selectedIds.has(participant.id)}
                      editable={summary.status === "JUDGING_STARTED" && fa.form.status === "STARTED"}
                      onToggle={toggleFaSelection}
                      onRequestRepeatTrack={openFaRepeatTrack}
                      onOpenDisqualify={openFaDisqualify}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── JUEZ: FA consolidado, esperando ronda ─────────────────────── */}
        {currentUser?.role === "JUDGE" && summary.status === "FA_CONSOLIDATED" && !fa && !round && (
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

        {currentUser?.role === "JUDGE" && summary.status === "JUDGING_CLOSED" && !fa && !round && (
          <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
            {judgeOfficialF2 ? (
              <OfficialResultBoard
                results={judgeOfficialF2.results}
                desertedResults={judgeOfficialF2.desertedResults}
                showPodium
                title="Resultado oficial"
                forceOfficialStatus
              />
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-6 py-8 text-center">
                <p className="text-base font-semibold text-slate-900">Resultado oficial</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  Aún no hay un resultado F2 consolidado para mostrar.
                </p>
              </div>
            )}
          </section>
        )}

        {/* ── JUEZ: rondas F1 / F2 / desempate ──────────────────────────── */}
        {currentUser?.role === "JUDGE" && round && (
          <JudgeRoundWorkspace
            stageId={stageId}
            round={round}
            busy={busy}
            onLocalUpdate={setRound}
            syncUnavailable={sessionExpired}
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
          confirmText={confirmDialog.confirmText}
          variant={confirmDialog.variant}
          busy={busy}
          onConfirm={async () => {
            setBusy(true);
            try {
              await confirmDialog.action();
              toast({ title: "Acción completada", variant: "success" });
              if (confirmDialog.redirectTo) {
                router.replace(confirmDialog.redirectTo);
                return;
              }
              await load();
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

      <FaDisqualifyDialog
        open={disqualifyTarget !== null}
        participant={disqualifyTarget}
        reasons={fa?.disqualificationReasons ?? []}
        busy={disqualifyBusy}
        onOpenChange={(open) => {
          if (!open && !disqualifyBusy) setDisqualifyTarget(null);
        }}
        onConfirm={confirmFaDisqualify}
      />

      <FaRepeatTrackDialog
        open={repeatTrackTarget !== null}
        participant={repeatTrackTarget}
        busy={repeatTrackBusy}
        onOpenChange={(open) => {
          if (!open && !repeatTrackBusy) setRepeatTrackTarget(null);
        }}
        onConfirm={confirmFaRepeatTrack}
      />

      <ActivateRoundDialog
        open={activateRoundTarget !== null}
        config={activateRoundTarget}
        onOpenChange={(open) => {
          if (!open && !busy) setActivateRoundTarget(null);
        }}
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await stagedFlowService.openNextRound(stageId);
            toast({
              title: "Prueba individual iniciada",
              variant: "success",
            });
            setActivateRoundTarget(null);
            await load();
          } catch (error) {
            toast({
              title: "Error",
              description: error instanceof Error ? error.message : "No fue posible activar la ronda.",
              variant: "error",
            });
          } finally {
            setBusy(false);
          }
        }}
      />

      <ConsolidateFaDialog
        open={consolidateFaOpen}
        onOpenChange={setConsolidateFaOpen}
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await stagedFlowService.consolidateFa(stageId);
            await load();
            toast({ title: "Formato FA consolidado", variant: "success" });
            setConsolidateFaOpen(false);
          } catch (error) {
            toast({
              title: "Error",
              description: error instanceof Error ? error.message : "No fue posible consolidar el formato FA.",
              variant: "error",
            });
          } finally {
            setBusy(false);
          }
        }}
      />

      <CloseFaDialog
        open={closeFaOpen}
        onOpenChange={setCloseFaOpen}
        summary={{
          selectedCount: selectedIds.size,
          maxSelected: 10,
          disqualifiedCount: fa?.form.disqualifiedCount ?? 0,
          discardedCount: fa
            ? fa.participants.filter(
                (p) =>
                  p.status === "ELIGIBLE" &&
                  !selectedIds.has(p.id) &&
                  p.decision?.decision !== "DISQUALIFIED"
              ).length
            : 0,
        }}
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            const response = await stagedFlowService.closeFa(stageId);
            if (response.data) {
              setFa(response.data);
              setSummary(response.data.stage);
            }
            toast({ title: "Formato FA cerrado", variant: "success" });
            setCloseFaOpen(false);
          } catch (error) {
            toast({
              title: "Error",
              description: error instanceof Error ? error.message : "No fue posible cerrar el formato FA.",
              variant: "error",
            });
          } finally {
            setBusy(false);
          }
        }}
      />

      <StartFaDialog
        open={startFaOpen}
        onOpenChange={setStartFaOpen}
        gaitLabel={`${summary.gait.name ?? "Sin andar"} - ${summary.category.minAgeMonths} a ${summary.category.maxAgeMonths} meses`}
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await stagedFlowService.startFa(stageId);
            toast({ title: "Formato FA iniciado", variant: "success" });
            setStartFaOpen(false);
            router.replace(`/staff/categories/${stageId}?view=FA`);
            await load();
          } catch (error) {
            toast({
              title: "Error",
              description: error instanceof Error ? error.message : "No fue posible iniciar el formato FA.",
              variant: "error",
            });
          } finally {
            setBusy(false);
          }
        }}
      />

      <ClosePreRingDialog
        open={closePreRingOpen}
        onOpenChange={setClosePreRingOpen}
        totalProcessed={checks.length}
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await stagedFlowService.closePreRing(stageId);
            await load();
            toast({ title: "Pre-pista cerrada", variant: "success" });
            setClosePreRingOpen(false);
          } catch (error) {
            toast({
              title: "Error",
              description: error instanceof Error ? error.message : "No fue posible cerrar la pre-pista.",
              variant: "error",
            });
          } finally {
            setBusy(false);
          }
        }}
      />

          <PushNotificationGate />
        </div>
      </ContentReveal>
    </PushNotificationProvider>
  );
}
