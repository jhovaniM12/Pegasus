import { Calendar, ClipboardList, List, MapPin, Trophy, Users } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";

const stats = [
  {
    title: "Ferias",
    value: "--",
    description: "Eventos registrados en el calendario operativo.",
    icon: Calendar,
    tone: "blue" as const,
  },
  {
    title: "Inscritos",
    value: "--",
    description: "Participantes cargados para las ferias activas.",
    icon: Users,
    tone: "emerald" as const,
  },
  {
    title: "Resultados",
    value: "--",
    description: "Registros de competencia pendientes de consolidar.",
    icon: Trophy,
    tone: "amber" as const,
  },
  {
    title: "Personas",
    value: "--",
    description: "Base de propietarios, montadores y personal.",
    icon: MapPin,
    tone: "violet" as const,
  },
  {
    title: "Categorías",
    value: "--",
    description: "Estructura competitiva disponible en el sistema.",
    icon: List,
    tone: "slate" as const,
  },
];

const nextTasks = [
  "Validar catálogo de categorías",
  "Revisar ferias pendientes",
  "Consolidar resultados recientes",
];

export default function DashboardPage() {
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 subtle-shadow">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Actividad reciente</h2>
              <p className="mt-1 text-sm text-slate-500">
                Aún no hay eventos recientes para mostrar.
              </p>
            </div>
            <div className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Sin actividad
            </div>
          </div>
          <div className="mt-6 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
            La actividad aparecerá aquí cuando se registren cambios.
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 subtle-shadow">
          <h2 className="text-lg font-semibold text-slate-950">Siguientes tareas</h2>
          <div className="mt-5 space-y-3">
            {nextTasks.map((task) => (
              <div key={task} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-3">
                <span className="size-2 rounded-full bg-amber-500" />
                <span className="text-sm font-medium text-slate-700">{task}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
