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
import type { PushGateErrorCode, PushGateStatus } from "@/hooks/use-push-notification-gate";

function errorDescription(errorCode: PushGateErrorCode | null): string {
  switch (errorCode) {
    case "permission_denied":
      return "Las notificaciones estan bloqueadas en el navegador. Habilitalas desde la configuracion del sitio para continuar.";
    case "service_worker":
      return "No fue posible preparar el servicio de notificaciones. Recarga la pagina e intenta nuevamente.";
    case "token":
      return "No fue posible validar tu sesion para notificaciones. Inicia sesion nuevamente si el problema persiste.";
    case "beams_state":
      return "El registro local de notificaciones quedo inconsistente. Intenta reactivarlas para reparar el registro.";
    default:
      return "No fue posible activar las notificaciones push. Intenta nuevamente para continuar.";
  }
}

function GateDialog({
  status,
  errorCode,
  onActivate,
}: {
  status: PushGateStatus;
  errorCode: PushGateErrorCode | null;
  onActivate: () => void | Promise<void>;
}) {
  const open =
    status === "needs_activation" ||
    status === "needs_reactivation" ||
    status === "activating" ||
    status === "blocked" ||
    status === "error";

  if (!open) return null;

  const isActivating = status === "activating";
  const isReactivation = status === "needs_reactivation";
  const isError = status === "error";
  const isBlocked = status === "blocked";

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-amber-50 ring-8 ring-amber-50/50">
            {isError || isBlocked ? (
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
              : isBlocked
                ? "Activa las notificaciones en el navegador"
              : isReactivation
                ? "Reactivar notificaciones"
                : "Notificaciones requeridas"}
          </DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            {isBlocked ? (
              "Para operar debes permitir las notificaciones desde el navegador. Abre el icono de configuracion junto a la URL, entra a Notificaciones y cambialas a Permitir."
            ) : isError ? (
              errorDescription(errorCode)
            ) : isReactivation ? (
              "Tu sesion de notificaciones es de otro usuario. Debes reactivarlas para continuar operando."
            ) : (
              "Para continuar debes activar las notificaciones del navegador. Sin ellas no recibiras avisos de cambios en tiempo real."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            type="button"
            className="w-full bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-60"
            disabled={isActivating || isBlocked}
            onClick={() => void onActivate()}
          >
            <BellRing className="size-4" />
            {isActivating
              ? "Activando..."
              : isBlocked
                ? "Activalas desde el navegador"
                : isError
                ? "Reintentar"
                : isReactivation
                  ? "Reactivar notificaciones"
                  : "Activar notificaciones"}
          </Button>

          {(status === "error" || status === "blocked") && (
            <p className="text-center text-xs text-slate-500">
              Despues de cambiar el permiso, recarga la pagina para continuar.
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

  return <GateDialog status={push.status} errorCode={push.errorCode} onActivate={push.activate} />;
}
