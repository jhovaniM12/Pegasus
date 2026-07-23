"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServiceWorkerUpdate } from "@/hooks/use-service-worker-update";

export function ServiceWorkerUpdateBanner() {
  const { updateAvailable, hasPendingMutations, applyUpdate, dismiss } = useServiceWorkerUpdate();

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] border-b border-sky-200 bg-sky-50 px-4 py-3 text-sky-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Actualización disponible</p>
          <p className="mt-0.5 text-xs text-sky-900">
            {hasPendingMutations
              ? "Hay cambios offline en este dispositivo. Al actualizar se conservarán; sincronízalos cuando puedas."
              : "Hay una nueva versión de Pegaso lista para instalar."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" size="sm" variant="outline" onClick={dismiss}>
            Más tarde
          </Button>
          <Button type="button" size="sm" onClick={() => void applyUpdate()}>
            <RefreshCw className="size-4" />
            Actualizar ahora
          </Button>
        </div>
      </div>
    </div>
  );
}
