"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { DetailPageSkeleton } from "@/components/loaders";
import { ReminderForm } from "@/app/(dashboard)/recordatorios/_components/reminder-form";
import { Button } from "@/components/ui/button";
import { judgingRemindersService } from "@/services/judging-reminders.service";
import type { JudgingReminder } from "@/types/judging-reminders";

export default function EditarRecordatorioPage() {
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
    return <DetailPageSkeleton fields={3} />;
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Catálogo
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
            Editar recordatorio
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Actualiza el nombre, icono o estado de {reminder.name}.
          </p>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/recordatorios">Volver al listado</Link>}
        />
      </div>

      <ReminderForm mode="edit" initialValues={reminder} />
    </div>
  );
}
