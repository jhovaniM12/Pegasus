"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePushNotificationsOptional } from "@/components/push-notification-provider";
import type { PushGateStatus } from "@/hooks/use-push-notification-gate";

function promptLabel(status: PushGateStatus): string {
  switch (status) {
    case "checking":
      return "Verificando...";
    case "activating":
      return "Activando...";
    case "needs_reactivation":
      return "Reactivar notificaciones";
    case "needs_activation":
      return "Activar notificaciones";
    case "error":
      return "Reintentar";
    default:
      return "Activar notificaciones";
  }
}

export function PushNotificationPrompt({ className }: { className?: string }) {
  const push = usePushNotificationsOptional();

  if (!push) {
    return null;
  }

  const { status, activate } = push;

  if (status === "enabled") {
    return <p className="text-xs text-emerald-700">Notificaciones activas.</p>;
  }

  if (status === "unsupported") {
    return <p className="text-xs text-slate-500">Este navegador no soporta notificaciones push.</p>;
  }

  if (status === "blocked") {
    return <p className="text-xs text-slate-500">Notificaciones bloqueadas en el navegador.</p>;
  }

  const isBusy = status === "checking" || status === "activating";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isBusy}
        onClick={() => void activate()}
      >
        {promptLabel(status)}
      </Button>
      {status === "error" && <p className="text-xs text-red-600">No fue posible activar push.</p>}
    </div>
  );
}
