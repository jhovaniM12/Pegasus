"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Eye,
  Gauge,
  Gavel,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Play,
  Stethoscope,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ConnectionIndicator } from "@/components/network-status";
import { StageStatusBadge, stageStatusLabels } from "@/components/stage-status-badge";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationInbox } from "@/components/notification-inbox";
import { PushNotificationPrompt } from "@/components/push-notification-prompt";
import { PegasoLogo } from "@/components/brand/pegaso-logo";
import { useToast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryCardSkeleton, ContentReveal, StaffFiltersSkeleton } from "@/components/loaders";
import { JudgeFormatActions } from "@/app/staff/_components/judge-format-actions";
import { StartFaDialog } from "@/app/staff/categories/[id]/_components/start-fa-dialog";
import { StartRoundDialog } from "@/app/staff/categories/[id]/_components/start-round-dialog";
import { PushNotificationGate } from "@/components/push-notification-gate";
import { PushNotificationProvider } from "@/components/push-notification-provider";
import { useStaffRealtimeRefresh } from "@/hooks/use-staff-realtime-refresh";
import { stagedFlowService } from "@/services/staged-flow.service";
import type { JudgeFormat, StageStatus, StagedCategory } from "@/types/staged-flow";

const ALL_STATUS_VALUE = "all";
const ALL_GAIT_VALUE = "all";

function categoryGaitLabel(category: StagedCategory): string {
  return `${category.gait.name ?? "Sin andar"} - ${category.category.minAgeMonths} a ${category.category.maxAgeMonths} meses`;
}

type StartRoundTarget = {
  category: StagedCategory;
  format: JudgeFormat & { key: "F1" | "F2" | "TIE_BREAK" };
};

const STAGE_STATUS_ORDER: StageStatus[] = [
  "NOT_STARTED",
  "PRE_RING_STARTED",
  "PRE_RING_CLOSED",
  "JUDGING_STARTED",
  "FA_CONSOLIDATED",
  "F1_IN_PROGRESS",
  "F1_CONSOLIDATED",
  "F2_IN_PROGRESS",
  "TIE_BREAK_IN_PROGRESS",
  "JUDGING_DESERTED",
  "JUDGING_CLOSED",
];

/** Estados en los que el juez puede abrir la categoría o actuar sobre formatos. */
const JUDGE_ACTIONABLE_STATUSES: StageStatus[] = [
  "JUDGING_STARTED",
  "FA_CONSOLIDATED",
  "F1_IN_PROGRESS",
  "F1_CONSOLIDATED",
  "F2_IN_PROGRESS",
  "TIE_BREAK_IN_PROGRESS",
  "JUDGING_DESERTED",
  "JUDGING_CLOSED",
];

function judgeCanActOnCategory(role: string | undefined, status: StageStatus): boolean {
  return role !== "JUDGE" || JUDGE_ACTIONABLE_STATUSES.includes(status);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CurrentUser = {
  id: string;
  personName: string | null;
  email: string | null;
  role: string;
  roleLabel: string;
};

type CardColor = "emerald" | "blue" | "amber" | "secondary" | "default";

type NavigateAction = {
  kind: "navigate";
  label: string;
  href: string;
  color: CardColor;
  icon: LucideIcon;
};

type ConfirmAction = {
  kind: "confirm";
  label: string;
  title: string;
  description: string;
  color: CardColor;
  icon: LucideIcon;
  call: () => Promise<StagedCategory>;
};

type CardAction = NavigateAction | ConfirmAction;

function actionButtonClass(color: CardColor): string {
  switch (color) {
    case "emerald":   return "bg-emerald-600 hover:bg-emerald-700 text-white";
    case "blue":      return "bg-blue-600 hover:bg-blue-700 text-white";
    case "amber":     return "bg-amber-500 hover:bg-amber-600 text-white";
    case "secondary": return "bg-slate-600 hover:bg-slate-700 text-white";
    case "default":   return "bg-slate-900 hover:bg-slate-800 text-white";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAgeRange(min: number, max: number): string {
  return `${min} - ${max} meses`;
}

/**
 * Determines whether the bottom card button is a navigation link or a
 * state-changing action that requires a confirmation dialog.
 *
 * Actions that mutate state (pre-ring / judging start) always require
 * confirmation. Read-only views navigate directly.
 */
function getCardAction(role: string | undefined, item: StagedCategory): CardAction {
  const href = `/staff/categories/${item.stageId}`;
  const categoryName = item.category.name ?? "esta categoría";
  const fairName = item.fair.name ?? "la feria";

  if (role === "TECHNICAL_DIRECTOR") {
    if (item.status === "NOT_STARTED") {
      return {
        kind: "confirm",
        color: "emerald",
        icon: Play,
        label: "Iniciar pre-pista",
        title: "Iniciar pre-pista",
        description: `Se iniciará la revisión veterinaria de "${categoryName}" en ${fairName}. El veterinario recibirá una notificación.`,
        call: () =>
          stagedFlowService.startPreRing(item.stageId).then((r) => {
            if (!r.data) throw new Error("Sin datos en la respuesta.");
            return r.data;
          }),
      };
    }

    if (item.status === "PRE_RING_CLOSED") {
      return {
        kind: "confirm",
        color: "blue",
        icon: Gavel,
        label: "Iniciar juzgamiento",
        title: "Iniciar juzgamiento",
        description: `Comenzará el juzgamiento con los ejemplares aprobados de "${categoryName}". Los jueces recibirán una notificación.`,
        call: () =>
          stagedFlowService.startJudging(item.stageId).then((r) => {
            if (!r.data) throw new Error("Sin datos en la respuesta.");
            return r.data;
          }),
      };
    }

    const dtActiveStatuses: StagedCategory["status"][] = [
      "JUDGING_STARTED",
      "FA_CONSOLIDATED",
      "F1_IN_PROGRESS",
      "F1_CONSOLIDATED",
      "F2_IN_PROGRESS",
      "TIE_BREAK_IN_PROGRESS",
    ];
    if (dtActiveStatuses.includes(item.status))
      return { kind: "navigate", color: "default", icon: LayoutDashboard, href, label: "Gestión" };
    return { kind: "navigate", color: "secondary", icon: Eye, href, label: "Ver gestión" };
  }

  if (role === "VETERINARIAN") {
    if (item.status === "PRE_RING_STARTED") return { kind: "navigate", color: "amber", icon: Stethoscope, href, label: "Checkeo veterinario" };
    return { kind: "navigate", color: "secondary", icon: Eye, href, label: "Ver categoría" };
  }

  if (role === "JUDGE") {
    const faReviewHref = `${href}?view=FA`;

    if (item.judge?.faFormStatus === "CLOSED") {
      return { kind: "navigate", color: "secondary", icon: Eye, href: faReviewHref, label: "Ver Formato FA" };
    }

    if (item.status === "JUDGING_STARTED") {
      return { kind: "navigate", color: "blue", icon: ClipboardList, href, label: "Formato FA" };
    }
    const judgeRoundStatuses: StagedCategory["status"][] = [
      "F1_IN_PROGRESS",
      "F2_IN_PROGRESS",
      "TIE_BREAK_IN_PROGRESS",
    ];
    if (judgeRoundStatuses.includes(item.status)) {
      const canJudgeRound = item.judge?.roundFormStatus === "PENDING" || item.judge?.roundFormStatus === "STARTED";
      return canJudgeRound
        ? { kind: "navigate", color: "blue", icon: Gavel, href, label: "Juzgar ronda" }
        : { kind: "navigate", color: "secondary", icon: Eye, href, label: "Ver categoría" };
    }
    return { kind: "navigate", color: "secondary", icon: Eye, href, label: "Ver categoría" };
  }

  return { kind: "navigate", color: "secondary", icon: Eye, href, label: "Ver categoría" };
}

// ─── StaffUserMenu ────────────────────────────────────────────────────────────

function StaffUserMenu({
  currentUser,
  onLogout,
  className = "",
}: {
  currentUser: CurrentUser | null;
  onLogout: () => void;
  className?: string;
}) {
  const displayName = currentUser?.personName ?? currentUser?.email ?? "Usuario";
  const roleLabel = currentUser?.roleLabel ?? "Staff";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={`flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${className}`}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white text-slate-500">
              <UserCircle className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-950">{displayName}</p>
              <p className="text-xs text-slate-500">{roleLabel}</p>
            </div>
            <ChevronDown className="size-4 shrink-0 text-slate-500" />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate text-sm font-semibold text-slate-950">{displayName}</span>
            <span className="mt-1 block text-xs font-normal text-slate-500">{roleLabel}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer" variant="destructive" onClick={onLogout}>
            <LogOut className="size-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── CategoryFilters ──────────────────────────────────────────────────────────

function CategoryFilters({
  categories,
  statusFilter,
  gaitFilter,
  onStatusChange,
  onGaitChange,
  onClear,
}: {
  categories: StagedCategory[];
  statusFilter: string;
  gaitFilter: string;
  onStatusChange: (value: string) => void;
  onGaitChange: (value: string) => void;
  onClear: () => void;
}) {
  const availableStatuses = useMemo(() => {
    const present = new Set(categories.map((item) => item.status));
    return STAGE_STATUS_ORDER.filter((status) => present.has(status));
  }, [categories]);

  const availableGaits = useMemo(() => {
    const byId = new Map<string, string>();
    for (const item of categories) {
      if (!byId.has(item.gait.id)) {
        byId.set(item.gait.id, item.gait.name ?? "Sin modalidad");
      }
    }
    return Array.from(byId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [categories]);

  const statusLabel =
    statusFilter === ALL_STATUS_VALUE
      ? "Estado"
      : stageStatusLabels[statusFilter as StageStatus] ?? "Estado";

  const gaitLabel =
    gaitFilter === ALL_GAIT_VALUE
      ? "Modalidad"
      : availableGaits.find((gait) => gait.id === gaitFilter)?.name ?? "Modalidad";

  const hasActiveFilters = statusFilter !== ALL_STATUS_VALUE || gaitFilter !== ALL_GAIT_VALUE;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className={`h-9 gap-2 rounded-md bg-white ${statusFilter !== ALL_STATUS_VALUE ? "border-slate-400" : ""}`}
            >
              <ListFilter className="size-3.5" />
              <span className="max-w-[180px] truncate">{statusLabel}</span>
              <ChevronDown className="size-3.5 text-slate-500" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => onStatusChange(ALL_STATUS_VALUE)}
          >
            Todos los estados
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {availableStatuses.map((status) => (
            <DropdownMenuItem
              key={status}
              className="cursor-pointer"
              onClick={() => onStatusChange(status)}
            >
              {stageStatusLabels[status]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className={`h-9 gap-2 rounded-md bg-white ${gaitFilter !== ALL_GAIT_VALUE ? "border-slate-400" : ""}`}
            >
              <ListFilter className="size-3.5" />
              <span className="max-w-[220px] truncate">{gaitLabel}</span>
              <ChevronDown className="size-3.5 text-slate-500" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => onGaitChange(ALL_GAIT_VALUE)}
          >
            Todas las modalidades
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {availableGaits.map((gait) => (
            <DropdownMenuItem
              key={gait.id}
              className="cursor-pointer"
              onClick={() => onGaitChange(gait.id)}
            >
              {gait.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-slate-600"
          onClick={onClear}
        >
          <X className="size-3.5" />
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [categories, setCategories] = useState<StagedCategory[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<(ConfirmAction & { open: boolean }) | null>(null);
  const [startFaTarget, setStartFaTarget] = useState<StagedCategory | null>(null);
  const [startRoundTarget, setStartRoundTarget] = useState<StartRoundTarget | null>(null);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUS_VALUE);
  const [gaitFilter, setGaitFilter] = useState(ALL_GAIT_VALUE);
  const [activeTab, setActiveTab] = useState<"pending" | "closed">("pending");

  const tabCategories = useMemo(() => {
    return categories.filter((item) => {
      const isClosed = item.status === "JUDGING_CLOSED" || item.status === "JUDGING_DESERTED";
      return activeTab === "closed" ? isClosed : !isClosed;
    });
  }, [categories, activeTab]);

  const filteredCategories = useMemo(() => {
    return tabCategories.filter((item) => {
      const matchesStatus = statusFilter === ALL_STATUS_VALUE || item.status === statusFilter;
      const matchesGait = gaitFilter === ALL_GAIT_VALUE || item.gait.id === gaitFilter;
      return matchesStatus && matchesGait;
    });
  }, [tabCategories, statusFilter, gaitFilter]);

  const clearFilters = () => {
    setStatusFilter(ALL_STATUS_VALUE);
    setGaitFilter(ALL_GAIT_VALUE);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as "pending" | "closed");
    setStatusFilter(ALL_STATUS_VALUE);
  };

  const reloadCategories = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        const [userResponse, categoriesResponse] = await Promise.all([
          fetch("/api/auth/me"),
          stagedFlowService.listCategories(),
        ]);
        if (!userResponse.ok) {
          if (!silent) {
            router.push("/login/staff");
          }
          return;
        }

        const userPayload = (await userResponse.json()) as { data?: CurrentUser };
        setCurrentUser(userPayload.data ?? null);
        setCategories(categoriesResponse.data ?? []);
      } catch {
        if (!silent) {
          router.push("/login/staff");
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [router]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void reloadCategories();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [reloadCategories]);

  useStaffRealtimeRefresh(
    () => reloadCategories({ silent: true }),
    { enableVisibilityRefresh: true, pollingMs: 30_000, debounceMs: 400 }
  );

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login/staff");
    router.refresh();
  };

  const openConfirm = (action: ConfirmAction) => {
    setConfirmDialog({ ...action, open: true });
  };

  const handleConfirm = async () => {
    if (!confirmDialog) return;
    setBusy(true);
    try {
      const updated = await confirmDialog.call();
      // Update the card in-place without full reload.
      setCategories((prev) => prev.map((c) => (c.stageId === updated.stageId ? updated : c)));
      toast({ title: "Acción completada.", variant: "success" });
      setConfirmDialog(null);
    } catch (error) {
      toast({
        title: "Error al ejecutar la acción.",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PushNotificationProvider userId={currentUser?.id}>
    <div className="min-h-screen bg-[#f5f7fb]">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <PegasoLogo size="xs" className="shrink-0" priority />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-normal text-slate-950">
                Categorías asignadas
              </h1>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <PushNotificationPrompt />
            <NotificationInbox />
            <ConnectionIndicator />
            <StaffUserMenu currentUser={currentUser} onLogout={logout} className="max-w-72" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:py-8">
        <div className="mb-4 space-y-3 sm:hidden">
          <PushNotificationPrompt className="flex-wrap" />
          <div className="flex items-center gap-3">
            <NotificationInbox />
            <ConnectionIndicator className="shrink-0" />
            <StaffUserMenu currentUser={currentUser} onLogout={logout} className="w-full bg-white" />
          </div>
        </div>

        {loading ? (
          <>
            <StaffFiltersSkeleton />
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <CategoryCardSkeleton key={index} index={index} />
              ))}
            </div>
          </>
        ) : categories.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-700">No hay categorías asignadas por ahora.</p>
          </div>
        ) : (
          <ContentReveal>
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/60 pb-px mb-6">
                <TabsList variant="line" className="h-10">
                  <TabsTrigger value="pending" className="px-4 py-2 text-sm">
                    Pendientes
                    {!loading && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs font-semibold">
                        {categories.filter((c) => c.status !== "JUDGING_CLOSED" && c.status !== "JUDGING_DESERTED").length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="closed" className="px-4 py-2 text-sm">
                    Cerradas
                    {!loading && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs font-semibold">
                        {categories.filter((c) => c.status === "JUDGING_CLOSED" || c.status === "JUDGING_DESERTED").length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <CategoryFilters
                  categories={tabCategories}
                  statusFilter={statusFilter}
                  gaitFilter={gaitFilter}
                  onStatusChange={setStatusFilter}
                  onGaitChange={setGaitFilter}
                  onClear={clearFilters}
                />
              </div>
            </Tabs>

            {filteredCategories.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No hay categorías que coincidan con los filtros seleccionados.
                </p>
              </div>
            ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredCategories.map((item) => {
              const action = getCardAction(currentUser?.role, item);
              const showCategoryAction = judgeCanActOnCategory(currentUser?.role, item.status);
              const showJudgeFormats =
                showCategoryAction &&
                currentUser?.role === "JUDGE" &&
                item.judge?.formats?.some((format) => format.formStatus !== "NOT_AVAILABLE");

              return (
                <article
                  key={item.stageId}
                  className="flex min-h-52 flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          <CalendarDays className="size-3.5" />
                          <span className="truncate">{item.fair.name ?? "Feria sin nombre"}</span>
                        </div>
                        <h2 className="mt-3 text-sm font-semibold leading-5 text-slate-950">
                          {item.category.name ?? "Categoría sin nombre"}
                        </h2>
                        <StageStatusBadge status={item.status} className="mt-2" />
                      </div>
                      <Badge variant="secondary" className="w-fit shrink-0 rounded-md">
                        {item.gait.name ?? "Sin andar"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          <Gauge className="size-3.5" />
                          Edad
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-950">
                          {formatAgeRange(item.category.minAgeMonths, item.category.maxAgeMonths)}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          <Users className="size-3.5" />
                          Inscritos
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{item.totalEntries}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-emerald-50 px-2 py-2 text-xs text-emerald-700">
                        <span className="block text-sm font-semibold">{item.veterinary.approved}</span>
                        Aprobados
                      </div>
                      <div className="rounded-md bg-slate-100 px-2 py-2 text-xs text-slate-600">
                        <span className="block text-sm font-semibold">{item.veterinary.pending}</span>
                        Pendientes
                      </div>
                      <div className="rounded-md bg-blue-50 px-2 py-2 text-xs text-blue-700">
                        <span className="block text-sm font-semibold">
                          {item.judging.closedForms}/{item.judging.totalJudges}
                        </span>
                        FA cerrados
                      </div>
                    </div>
                  </div>

                  {/* Bottom action: confirm dialog for state mutations, Link for views */}
                  {showJudgeFormats ? (
                    <JudgeFormatActions
                      stageId={item.stageId}
                      formats={item.judge!.formats}
                      officialResultAvailable={item.status === "JUDGING_CLOSED"}
                      onStartFa={() => setStartFaTarget(item)}
                      onStartRound={(format) => {
                        if (format.key === "F1" || format.key === "F2" || format.key === "TIE_BREAK") {
                          setStartRoundTarget({ category: item, format: { ...format, key: format.key } });
                        }
                      }}
                    />
                  ) : showCategoryAction && action.kind === "confirm" ? (
                    <Button
                      className={`mt-5 w-full rounded-md ${actionButtonClass(action.color)}`}
                      disabled={busy}
                      onClick={() => openConfirm(action)}
                    >
                      <action.icon className="size-4" />
                      {action.label}
                    </Button>
                  ) : showCategoryAction && action.kind === "navigate" ? (
                    <Button
                      className={`mt-5 w-full rounded-md ${actionButtonClass(action.color)}`}
                      nativeButton={false}
                      render={<Link href={action.href} />}
                    >
                      <action.icon className="size-4" />
                      {action.label}
                    </Button>
                  ) : null}
                </article>
              );
            })}
          </div>
            )}
          </ContentReveal>
        )}
      </main>

      {confirmDialog && (
        <ConfirmActionDialog
          open={confirmDialog.open}
          onOpenChange={(open) => {
            if (!open && !busy) setConfirmDialog(null);
          }}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmText={confirmDialog.label}
          busy={busy}
          onConfirm={handleConfirm}
        />
      )}

      <StartFaDialog
        open={startFaTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setStartFaTarget(null);
        }}
        gaitLabel={startFaTarget ? categoryGaitLabel(startFaTarget) : ""}
        busy={busy}
        onConfirm={async () => {
          if (!startFaTarget) return;
          setBusy(true);
          try {
            await stagedFlowService.startFa(startFaTarget.stageId);
            toast({ title: "Formato FA iniciado", variant: "success" });
            setStartFaTarget(null);
            router.push(`/staff/categories/${startFaTarget.stageId}?view=FA`);
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

      <StartRoundDialog
        open={startRoundTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setStartRoundTarget(null);
        }}
        roundKey={startRoundTarget?.format.key ?? "F2"}
        gaitLabel={startRoundTarget ? categoryGaitLabel(startRoundTarget.category) : ""}
        participantCount={startRoundTarget?.format.participantCount}
        busy={busy}
        onConfirm={async () => {
          if (!startRoundTarget) return;

          const { category, format } = startRoundTarget;
          setBusy(true);
          try {
            await stagedFlowService.startRoundForm(category.stageId);
            toast({ title: `Formato ${format.key} iniciado`, variant: "success" });
            setStartRoundTarget(null);
            router.push(`/staff/categories/${category.stageId}?view=${format.key}`);
          } catch (error) {
            toast({
              title: "Error",
              description:
                error instanceof Error
                  ? error.message
                  : `No fue posible iniciar el formato ${format.key}.`,
              variant: "error",
            });
          } finally {
            setBusy(false);
          }
        }}
      />

      <PushNotificationGate />
    </div>
    </PushNotificationProvider>
  );
}
