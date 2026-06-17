"use client";

import { Calendar, ClipboardList, List, MapPin, Trophy, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { StatCard } from "@/components/dashboard/stat-card";
import { ContentReveal, StatCardSkeleton } from "@/components/loaders";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardService } from "@/services/dashboard.service";
import type { RootDashboardSummary } from "@/types/dashboard";

const numberFormatter = new Intl.NumberFormat("es-CO");

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

const statDefinitions = [
  {
    key: "fairs" as const,
    title: "Ferias",
    description: "Eventos registrados en el calendario operativo.",
    icon: Calendar,
    tone: "blue" as const,
  },
  {
    key: "registeredEntries" as const,
    title: "Inscritos",
    description: "Participantes cargados para las ferias activas.",
    icon: Users,
    tone: "emerald" as const,
  },
  {
    key: "pendingResults" as const,
    title: "Resultados",
    description: "Registros de competencia pendientes de consolidar.",
    icon: Trophy,
    tone: "amber" as const,
  },
  {
    key: "people" as const,
    title: "Personas",
    description: "Base de propietarios, montadores y personal.",
    icon: MapPin,
    tone: "violet" as const,
  },
  {
    key: "categories" as const,
    title: "Categorías",
    description: "Estructura competitiva disponible en el sistema.",
    icon: List,
    tone: "slate" as const,
  },
];

export default function DashboardPage() {
  const [summary, setSummary] = useState<RootDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await dashboardService.getSummary();
        setSummary(response.data ?? null);
      } catch {
        setError("No se pudo cargar el resumen operativo.");
      } finally {
        setLoading(false);
      }
    };

    void loadSummary();
  }, []);

  const stats = useMemo(() => {
    return statDefinitions.map(({ key: statKey, ...definition }) => ({
      ...definition,
      value: numberFormatter.format(summary?.stats[statKey] ?? 0),
    }));
  }, [summary]);

  const hasActivity = (summary?.recentActivity.length ?? 0) > 0;

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-slate-200 bg-white px-6 py-6 subtle-shadow md:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              Resumen operativo
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">
              Dashboard General
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Vista central para monitorear ferias, inscripciones, resultados y catálogos
              base de Pegasus.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <ClipboardList className="size-5 text-slate-500" />
            <div>
              <p className="text-sm font-semibold text-slate-950">Fase inicial</p>
              <p className="text-xs text-slate-500">Datos base y operación administrativa</p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {loading
          ? statDefinitions.map((stat) => <StatCardSkeleton key={stat.key} />)
          : stats.map((stat) => <StatCard key={stat.title} {...stat} />)}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 subtle-shadow">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Actividad reciente</h2>
            <p className="mt-1 text-sm text-slate-500">
              {!loading && hasActivity
                ? "Últimos cambios registrados en el flujo operativo."
                : !loading
                  ? "Aún no hay eventos recientes para mostrar."
                  : "Recuperando los últimos eventos del sistema."}
            </p>
          </div>
          <div className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {loading ? "Cargando" : hasActivity ? "En vivo" : "Sin actividad"}
          </div>
        </div>

        {loading ? (
          <ul className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <li
                key={index}
                className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-full max-w-md" />
                  </div>
                  <Skeleton className="h-3 w-20" />
                </div>
              </li>
            ))}
          </ul>
        ) : hasActivity ? (
          <ContentReveal>
          <ul className="mt-6 space-y-3">
            {summary?.recentActivity.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                  </div>
                  <time
                    className="shrink-0 text-xs text-slate-500"
                    dateTime={item.occurredAt}
                  >
                    {dateTimeFormatter.format(new Date(item.occurredAt))}
                  </time>
                </div>
              </li>
            ))}
          </ul>
          </ContentReveal>
        ) : (
          <div className="mt-6 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
            La actividad aparecerá aquí cuando se registren cambios.
          </div>
        )}
      </section>
    </div>
  );
}
