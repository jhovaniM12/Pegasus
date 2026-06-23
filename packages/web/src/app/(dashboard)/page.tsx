"use client";

import { Calendar, List, MapPin, Trophy, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ActivityChart } from "@/components/dashboard/activity-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { ContentReveal, StatCardSkeleton } from "@/components/loaders";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dashboardService } from "@/services/dashboard.service";
import type { RootDashboardSummary } from "@/types/dashboard";

const numberFormatter = new Intl.NumberFormat("es-CO");

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "short",
  timeStyle: "short",
});

const statDefinitions = [
  {
    key: "fairs" as const,
    title: "Ferias",
    description: "Eventos registrados en el sistema.",
    icon: Calendar,
    tone: "blue" as const,
  },
  {
    key: "registeredEntries" as const,
    title: "Inscritos",
    description: "Participantes en ferias activas.",
    icon: Users,
    tone: "emerald" as const,
  },
  {
    key: "pendingResults" as const,
    title: "En juzgamiento",
    description: "Categorías activas sin cierre oficial.",
    icon: Trophy,
    tone: "amber" as const,
  },
  {
    key: "people" as const,
    title: "Personas",
    description: "Propietarios, montadores y staff.",
    icon: MapPin,
    tone: "violet" as const,
  },
  {
    key: "categories" as const,
    title: "Categorías",
    description: "Estructura competitiva disponible.",
    icon: List,
    tone: "slate" as const,
  },
];

export default function DashboardPage() {
  const [summary, setSummary] = useState<RootDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
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

    void load();
  }, []);

  const stats = useMemo(() => {
    return statDefinitions.map(({ key: statKey, ...definition }) => ({
      ...definition,
      value: numberFormatter.format(summary?.stats[statKey] ?? 0),
    }));
  }, [summary]);

  const hasActivity = (summary?.recentActivity.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stats row */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {loading
          ? statDefinitions.map((s) => <StatCardSkeleton key={s.key} />)
          : stats.map((stat) => <StatCard key={stat.title} {...stat} />)}
      </section>

      {/* Chart */}
      <section>
        <ActivityChart data={summary?.chartData ?? []} loading={loading} />
      </section>

      {/* Recent activity table */}
      <section>
        <Card className="rounded-xl border border-border bg-card subtle-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-5 px-5">
            <div>
              <CardTitle className="text-base font-semibold">
                Actividad reciente
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {loading
                  ? "Recuperando eventos del sistema..."
                  : hasActivity
                    ? "Últimos eventos registrados en el flujo operativo."
                    : "Aún no hay eventos para mostrar."}
              </p>
            </div>
            {!loading && (
              <Badge variant="secondary" className="text-xs">
                {hasActivity ? "En vivo" : "Sin actividad"}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {loading ? (
              <div className="px-5 pb-5 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-4">
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3.5 w-64" />
                    </div>
                    <Skeleton className="h-3.5 w-28 shrink-0" />
                  </div>
                ))}
              </div>
            ) : hasActivity ? (
              <ContentReveal>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60">
                      <TableHead className="px-5 text-xs font-medium text-muted-foreground">
                        Evento
                      </TableHead>
                      <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                        Contexto
                      </TableHead>
                      <TableHead className="px-5 text-right text-xs font-medium text-muted-foreground">
                        Fecha
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary?.recentActivity.map((item) => (
                      <TableRow key={item.id} className="border-border/40">
                        <TableCell className="px-5 py-3 font-medium text-sm text-foreground">
                          {item.title}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                          {item.description}
                        </TableCell>
                        <TableCell className="px-5 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {dateTimeFormatter.format(new Date(item.occurredAt))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ContentReveal>
            ) : (
              <div className="flex min-h-32 items-center justify-center px-5 pb-5 text-sm text-muted-foreground">
                La actividad aparecerá aquí cuando se registren cambios.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
