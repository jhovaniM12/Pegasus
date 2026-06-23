import {
  AwardDistinctive,
  Category,
  Fair,
  FairCategoryStage,
  FairEntry,
  getDataSource,
  Person,
  WorkflowEvent
} from "@pegasus/core";

const IN_PROGRESS_STAGE_STATUSES: Array<FairCategoryStage["status"]> = [
  "PRE_RING_STARTED",
  "PRE_RING_CLOSED",
  "JUDGING_STARTED",
  "FA_CONSOLIDATED",
  "F1_IN_PROGRESS",
  "F1_CONSOLIDATED",
  "F2_IN_PROGRESS",
  "TIE_BREAK_IN_PROGRESS"
];

const WORKFLOW_EVENT_LABELS: Record<string, string> = {
  PRE_RING_STARTED: "Pre-ring iniciado",
  PRE_RING_CLOSED: "Pre-ring cerrado",
  JUDGING_STARTED: "Juzgamiento iniciado",
  FA_STARTED: "Formato FA iniciado",
  JUDGE_FA_CLOSED: "Formulario FA cerrado",
  JUDGING_PARTICIPANT_DISQUALIFIED: "Participante descalificado",
  FA_CONSOLIDATED: "FA consolidado",
  ROUND_OPENED: "Ronda abierta",
  ROUND_FORM_STARTED: "Formulario de ronda iniciado",
  ROUND_FORM_CLOSED: "Formulario de ronda cerrado",
  ROUND_CONSOLIDATED: "Ronda consolidada",
  TIE_DETECTED: "Empate detectado",
  TIE_BREAK_OPENED: "Desempate abierto",
  TIE_BREAK_TEST_RECORDED: "Prueba de desempate registrada",
  COMPETITION_DESERTED: "Competencia declarada desierta",
  JUDGING_CLOSED: "Juzgamiento cerrado"
};

export type RootDashboardStats = {
  fairs: number;
  registeredEntries: number;
  pendingResults: number;
  people: number;
  categories: number;
};

export type RootDashboardActivityItem = {
  id: string;
  occurredAt: string;
  title: string;
  description: string;
};

export type RootDashboardTask = {
  id: string;
  label: string;
  href: string | null;
};

export type RootDashboardChartPoint = {
  month: string;
  events: number;
};

export type RootDashboardSummary = {
  stats: RootDashboardStats;
  recentActivity: RootDashboardActivityItem[];
  nextTasks: RootDashboardTask[];
  chartData: RootDashboardChartPoint[];
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function activeFairFilter(today: string) {
  return `(fair.startDate IS NULL OR fair.startDate <= :today)
    AND (fair.endDate IS NULL OR fair.endDate >= :today)`;
}

function formatActivityDescription(
  event: WorkflowEvent,
  fairName: string | null,
  categoryName: string | null
): string {
  const parts = [fairName, categoryName].filter(Boolean);
  const context = parts.length > 0 ? parts.join(" · ") : "Operación general";

  if (event.fromStatus && event.toStatus) {
    return `${context} (${event.fromStatus} → ${event.toStatus})`;
  }

  return context;
}

export async function getRootDashboardSummary(): Promise<RootDashboardSummary> {
  const dataSource = await getDataSource();
  const today = todayIsoDate();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [
    fairs,
    registeredEntries,
    pendingResults,
    people,
    categories,
    notStartedStages,
    inactiveDistinctives,
    recentEvents,
    rawChartData
  ] = await Promise.all([
    dataSource.getRepository(Fair).count(),
    dataSource
      .getRepository(FairEntry)
      .createQueryBuilder("entry")
      .innerJoin("entry.fair", "fair")
      .where("entry.participate = :participate", { participate: true })
      .andWhere(activeFairFilter(today), { today })
      .getCount(),
    dataSource
      .getRepository(FairCategoryStage)
      .createQueryBuilder("stage")
      .where("stage.status IN (:...statuses)", { statuses: IN_PROGRESS_STAGE_STATUSES })
      .getCount(),
    dataSource.getRepository(Person).count(),
    dataSource.getRepository(Category).count(),
    dataSource.getRepository(FairCategoryStage).count({ where: { status: "NOT_STARTED" } }),
    dataSource.getRepository(AwardDistinctive).count({ where: { isActive: false } }),
    dataSource.getRepository(WorkflowEvent).find({
      relations: {
        fairCategoryStage: {
          fair: true,
          category: true
        }
      },
      order: { createdAt: "DESC" },
      take: 8
    }),
    dataSource.getRepository(WorkflowEvent)
      .createQueryBuilder("event")
      .select("TO_CHAR(DATE_TRUNC('month', event.createdAt), 'YYYY-MM')", "month")
      .addSelect("COUNT(*)", "count")
      .where("event.createdAt >= :since", { since: sixMonthsAgo })
      .groupBy("DATE_TRUNC('month', event.createdAt)")
      .orderBy("DATE_TRUNC('month', event.createdAt)", "ASC")
      .getRawMany<{ month: string; count: string }>()
  ]);

  const recentActivity: RootDashboardActivityItem[] = recentEvents.map((event) => ({
    id: event.id,
    occurredAt: event.createdAt.toISOString(),
    title: WORKFLOW_EVENT_LABELS[event.eventType] ?? event.eventType,
    description: formatActivityDescription(
      event,
      event.fairCategoryStage?.fair?.name ?? null,
      event.fairCategoryStage?.category?.name ?? null
    )
  }));

  const nextTasks = buildNextTasks({
    categories,
    notStartedStages,
    pendingResults,
    inactiveDistinctives
  });

  const chartData = buildChartData(rawChartData);

  return {
    stats: {
      fairs,
      registeredEntries,
      pendingResults,
      people,
      categories
    },
    recentActivity,
    nextTasks,
    chartData
  };
}

const MONTH_LABELS: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic"
};

function buildChartData(
  raw: { month: string; count: string }[]
): RootDashboardChartPoint[] {
  const dataMap = new Map(raw.map((r) => [r.month, parseInt(r.count, 10)]));

  const points: RootDashboardChartPoint[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthPart = key.slice(5, 7);
    points.push({
      month: `${MONTH_LABELS[monthPart]} ${d.getFullYear()}`,
      events: dataMap.get(key) ?? 0
    });
  }

  return points;
}

function buildNextTasks(input: {
  categories: number;
  notStartedStages: number;
  pendingResults: number;
  inactiveDistinctives: number;
}): RootDashboardTask[] {
  const tasks: RootDashboardTask[] = [];

  if (input.categories === 0) {
    tasks.push({
      id: "validate-categories",
      label: "Validar catálogo de categorías",
      href: "/categories"
    });
  }

  if (input.notStartedStages > 0) {
    tasks.push({
      id: "review-pending-fairs",
      label: `Revisar ${input.notStartedStages} categoría(s) pendientes de iniciar`,
      href: "/fairs"
    });
  }

  if (input.pendingResults > 0) {
    tasks.push({
      id: "consolidate-results",
      label: `Consolidar resultados en ${input.pendingResults} categoría(s) en curso`,
      href: "/fairs"
    });
  }

  if (input.inactiveDistinctives > 0) {
    tasks.push({
      id: "configure-distinctives",
      label: "Revisar distintivos de premiación inactivos",
      href: "/settings"
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      id: "all-clear",
      label: "Sin tareas pendientes — operación al día",
      href: null
    });
  }

  return tasks.slice(0, 5);
}
