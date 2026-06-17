import Link from "next/link";

import { ReminderForm } from "@/app/(dashboard)/recordatorios/_components/reminder-form";
import { Button } from "@/components/ui/button";

export default function NuevoRecordatorioPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Catálogo
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
            Nuevo recordatorio
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Define el nombre y el icono que identificará este recordatorio.
          </p>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/recordatorios">Volver al listado</Link>}
        />
      </div>

      <ReminderForm mode="create" />
    </div>
  );
}
