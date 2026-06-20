"use client";

import { BellOff, BellRing, RefreshCw, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePushNotificationsOptional } from "@/components/push-notification-provider";
import type { PushGateStatus } from "@/hooks/use-push-notification-gate";

function GateDialog({
  status,
  onActivate,
}: {
  status: PushGateStatus;
  onActivate: () => void | Promise<void>;
}) {
  const open =
    status === "needs_activation" ||
    status === "needs_reactivation" ||
    status === "activating" ||
    status === "error";

  if (!open) return null;

  const isActivating = status === "activating";
  const isReactivation = status === "needs_reactivation";
  const isError = status === "error";

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-amber-50 ring-8 ring-amber-50/50">
            {isError ? (
              <ShieldAlert className="size-7 text-amber-600" />
            ) : isReactivation ? (
              <RefreshCw className="size-7 text-amber-600" />
            ) : (
              <BellOff className="size-7 text-amber-600" />
            )}
          </div>
          <DialogTitle className="text-center text-base">
            {isError
              ? "Error al activar notificaciones"
              : isReactivation
                ? "Reactivar notificaciones"
                : "Notificaciones requeridas"}
          </DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            {isError ? (
              "No fue posible activar las notificaciones push. Intenta nuevamente para continuar."
            ) : isReactivation ? (
              "Tu sesión de notificaciones es de otro usuario. Debes reactivarlas para continuar operando."
            ) : (
              "Para continuar necesitas activar las notificaciones push. Sin ellas no recibirás avisos de cambios en tiempo real."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            type="button"
            className="w-full bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-60"
            disabled={isActivating}
            onClick={() => void onActivate()}
          >
            <BellRing className="size-4" />
            {isActivating
              ? "Activando..."
              : isError
                ? "Reintentar"
                : isReactivation
                  ? "Reactivar notificaciones"
                  : "Activar notificaciones"}
          </Button>

          {status === "error" && (
            <p className="text-center text-xs text-slate-500">
              Si el problema persiste, verifica que el navegador tenga permisos de notificación habilitados.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PushNotificationGate() {
  const push = usePushNotificationsOptional();
  if (!push) return null;

  return <GateDialog status={push.status} onActivate={push.activate} />;
}
