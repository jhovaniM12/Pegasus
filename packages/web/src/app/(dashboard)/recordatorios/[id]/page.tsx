"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { ContentReveal, DetailPageSkeleton } from "@/components/loaders";
import { ReminderIcon } from "@/components/reminder-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { judgingRemindersService } from "@/services/judging-reminders.service";
import type { JudgingReminder } from "@/types/judging-reminders";

export default function VerRecordatorioPage() {
  const params = useParams<{ id: string }>();
  const [reminder, setReminder] = useState<JudgingReminder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadReminder = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await judgingRemindersService.getJudgingReminder(params.id);
        setReminder(response.data ?? null);
      } catch {
        setError("No se encontró el recordatorio solicitado.");
      } finally {
        setLoading(false);
      }
    };

    void loadReminder();
  }, [params.id]);

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (error || !reminder) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error ?? "Recordatorio no encontrado."}</p>
        <Button variant="outline" nativeButton={false} render={<Link href="/recordatorios">Volver</Link>} />
      </div>
    );
  }

  return (
    <ContentReveal>
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Catálogo
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
            {reminder.name}
          </h1>
          <p className="mt-2 text-sm text-slate-500">Detalle del recordatorio.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/recordatorios">Volver</Link>}
          />
          <Button
            nativeButton={false}
            render={<Link href={`/recordatorios/${reminder.id}/editar`}>Editar</Link>}
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 subtle-shadow">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{reminder.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Icono</dt>
            <dd className="mt-1 flex items-center gap-2 text-sm text-slate-700">
              <ReminderIcon icon={reminder.icon} className="size-4" />
              {reminder.icon}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</dt>
            <dd className="mt-1">
              <Badge variant={reminder.isActive ? "secondary" : "outline"}>
                {reminder.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ejemplar</dt>
            <dd className="mt-1 text-sm text-slate-400">—</dd>
          </div>
        </dl>
      </div>
    </div>
    </ContentReveal>
  );
}
