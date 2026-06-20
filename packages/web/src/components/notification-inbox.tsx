"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archive, Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStaffRealtimeRefresh } from "@/hooks/use-staff-realtime-refresh";
import { useToast } from "@/components/ui/toast";
import { stagedFlowService } from "@/services/staged-flow.service";
import type { StaffNotification } from "@/types/staged-flow";

type InboxState = {
  unreadCount: number;
  notifications: StaffNotification[];
};

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

function getActionLabel(type: string): string {
  switch (type) {
    case "PRE_RING_STARTED": return "Ir a Chequeo Veterinario";
    case "PRE_RING_CLOSED": return "Iniciar Juzgamiento";
    case "JUDGING_STARTED": return "Ver Juzgamiento";
    case "JUDGE_FA_CLOSED": return "Ver Gestión";
    case "FA_CONSOLIDATED": return "Ver Resultados";
    case "JUDGING_PARTICIPANT_DISQUALIFIED": return "Ver FA";
    default: return "Ver categoría";
  }
}

export function NotificationInbox() {
  const [state, setState] = useState<InboxState>({ unreadCount: 0, notifications: [] });
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const prevIdsRef = useRef<Set<string>>(new Set());
  const hasInitialLoadedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await stagedFlowService.listNotifications(20);
      const data = response.data ?? { unreadCount: 0, notifications: [] };

      // Mostrar toast solo después de la carga inicial, para notificaciones nuevas no leídas.
      if (hasInitialLoadedRef.current) {
        const incoming = data.notifications.filter(
          (n) => !prevIdsRef.current.has(n.id) && !n.readAt
        );
        for (const n of incoming) {
          toast({
            variant: "notification",
            notificationType: n.type,
            title: n.title,
            description: n.body,
            fairName: n.fairName,
            categoryName: n.categoryName,
            gaitName: n.gaitName,
            deepLink: n.deepLink,
            actionLabel: getActionLabel(n.type),
          });
        }
      }

      prevIdsRef.current = new Set(data.notifications.map((n) => n.id));
      hasInitialLoadedRef.current = true;
      setState(data);
    } catch {
      setError("No fue posible cargar la bandeja.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [load]);

  useStaffRealtimeRefresh(() => load(), { debounceMs: 400 });

  // Polling de respaldo: refresca la bandeja cada 30 segundos en caso de que
  // el service worker no haya podido enviar el mensaje (e.g. tab en segundo plano).
  useEffect(() => {
    const interval = setInterval(() => void load(), 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const markRead = async (notificationId: string) => {
    setBusyId(notificationId);
    try {
      await stagedFlowService.markNotificationRead(notificationId);
      await load();
    } catch {
      setError("No fue posible marcar la notificacion.");
    } finally {
      setBusyId(null);
    }
  };

  const markAllRead = async () => {
    setBusyId("read-all");
    try {
      const response = await stagedFlowService.markAllNotificationsRead();
      setState(response.data ?? { unreadCount: 0, notifications: [] });
    } catch {
      setError("No fue posible marcar las notificaciones.");
    } finally {
      setBusyId(null);
    }
  };

  const archive = async (notificationId: string) => {
    setBusyId(notificationId);
    try {
      await stagedFlowService.archiveNotification(notificationId);
      await load();
    } catch {
      setError("No fue posible archivar la notificacion.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Notificaciones"
            className="relative flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            onClick={() => void load()}
          >
            <Bell className="size-5" />
            {state.unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[0.68rem] font-semibold leading-5 text-white">
                {state.unreadCount > 99 ? "99+" : state.unreadCount}
              </span>
            )}
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="border-b border-slate-200 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-950">Notificaciones</p>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={state.unreadCount === 0 || busyId === "read-all"}
              onClick={markAllRead}
            >
              <CheckCheck className="size-3.5" />
              Leer todas
            </Button>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {error ? (
            <div className="px-2 py-6 text-center">
              <p className="text-sm text-red-600">{error}</p>
              <Button type="button" size="xs" variant="outline" className="mt-3" onClick={() => void load()}>
                Reintentar
              </Button>
            </div>
          ) : loading && state.notifications.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">Cargando notificaciones...</p>
          ) : state.notifications.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">No hay notificaciones por ahora.</p>
          ) : (
            <div className="space-y-2">
              {state.notifications.map((notification) => {
                const unread = !notification.readAt;

                return (
                  <article
                    key={notification.id}
                    className={`rounded-md border p-3 ${
                      unread ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-950">{notification.title}</p>
                        <p className="mt-1 text-sm leading-5 text-slate-600">{notification.body}</p>
                        <p className="mt-2 text-xs text-slate-500">{formatRelativeTime(notification.createdAt)}</p>
                      </div>
                      {unread && <span className="mt-1 size-2 shrink-0 rounded-full bg-blue-600" />}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {notification.deepLink && (
                        <Button
                          nativeButton={false}
                          size="xs"
                          variant="outline"
                          render={<Link href={notification.deepLink} />}
                        >
                          <ExternalLink className="size-3.5" />
                          Abrir
                        </Button>
                      )}
                      {unread && (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={busyId === notification.id}
                          onClick={() => void markRead(notification.id)}
                        >
                          <Check className="size-3.5" />
                          Leida
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        disabled={busyId === notification.id}
                        onClick={() => void archive(notification.id)}
                      >
                        <Archive className="size-3.5" />
                        Archivar
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
