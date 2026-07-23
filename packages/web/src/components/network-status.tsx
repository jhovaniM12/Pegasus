"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { RefreshCw, TriangleAlert, Wifi, WifiOff } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OfflineMutationCenter } from "@/components/offline-mutation-center";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  checkPegasusConnectivity,
  type ConnectivityState,
} from "@/offline/connectivity";
import { useOfflineSyncSummary } from "@/hooks/use-offline-sync-summary";
import { syncAllPendingForUser } from "@/offline/sync-engine";

type NetworkStatusContextValue = {
  isOnline: boolean;
  connectivityState: ConnectivityState;
  checkNow: () => Promise<ConnectivityState>;
};

const NetworkStatusContext = createContext<NetworkStatusContextValue | null>(null);
const CONNECTIVITY_CHECK_INTERVAL_MS = 5000;

export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  // No afirmar conexión hasta que la propia API de Pegaso responda.
  const [connectivityState, setConnectivityState] = useState<ConnectivityState>("DEGRADED");
  const hasMounted = useRef(false);
  const wasOffline = useRef(false);
  const consecutiveFailures = useRef(0);

  const checkNow = useCallback(async (): Promise<ConnectivityState> => {
    const apiAvailable = await checkPegasusConnectivity();
    let nextState: ConnectivityState;

    if (apiAvailable) {
      consecutiveFailures.current = 0;
      nextState = "ONLINE";
    } else if (!navigator.onLine) {
      consecutiveFailures.current += 1;
      nextState = "OFFLINE";
    } else {
      consecutiveFailures.current += 1;
      nextState = consecutiveFailures.current >= 2 ? "OFFLINE" : "DEGRADED";
    }

    setConnectivityState(nextState);
    return nextState;
  }, []);

  useEffect(() => {
    let isDisposed = false;

    const updateStatus = async () => {
      const apiAvailable = await checkPegasusConnectivity();

      if (isDisposed) {
        return;
      }

      let nextState: ConnectivityState;
      if (apiAvailable) {
        consecutiveFailures.current = 0;
        nextState = "ONLINE";
      } else if (!navigator.onLine) {
        consecutiveFailures.current += 1;
        nextState = "OFFLINE";
      } else {
        consecutiveFailures.current += 1;
        nextState = consecutiveFailures.current >= 2 ? "OFFLINE" : "DEGRADED";
      }
      setConnectivityState(nextState);

      if (!hasMounted.current) {
        hasMounted.current = true;
        wasOffline.current = nextState === "OFFLINE";
        return;
      }

      if (nextState === "OFFLINE") {
        if (!wasOffline.current) {
          toast({
            variant: "error",
            title: "Sin conexión",
            description: "La API de Pegaso no responde. Algunas acciones pueden no estar disponibles.",
          });
        }

        wasOffline.current = true;
        return;
      }

      if (wasOffline.current) {
        wasOffline.current = false;
        toast({
          variant: "success",
          title: "Conexión restaurada",
          description: "Ya tienes conexión a internet nuevamente.",
        });
      }
    };

    void updateStatus();
    const intervalId = window.setInterval(() => {
      void updateStatus();
    }, CONNECTIVITY_CHECK_INTERVAL_MS);
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    window.addEventListener("focus", updateStatus);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void updateStatus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
      window.removeEventListener("focus", updateStatus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [toast]);

  const value = useMemo(
    () => ({
      isOnline: connectivityState === "ONLINE",
      connectivityState,
      checkNow,
    }),
    [checkNow, connectivityState]
  );

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
      <OfflineBanner />
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus() {
  const context = useContext(NetworkStatusContext);

  if (!context) {
    throw new Error("useNetworkStatus debe usarse dentro de NetworkStatusProvider.");
  }

  return context;
}

export function ConnectionIndicator({ className = "" }: { className?: string }) {
  const { connectivityState } = useNetworkStatus();
  const isOnline = connectivityState === "ONLINE";
  const isDegraded = connectivityState === "DEGRADED";
  const Icon = isOnline ? Wifi : isDegraded ? TriangleAlert : WifiOff;
  const title = isOnline
    ? "Conectado a Pegaso"
    : isDegraded
      ? "Conexión inestable con Pegaso"
      : "Sin conexión con Pegaso";

  return (
    <div
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-lg border",
        isOnline
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : isDegraded
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-red-200 bg-red-50 text-red-700",
        className
      )}
      title={title}
      aria-label={title}
    >
      <Icon className="size-4 shrink-0" />
    </div>
  );
}

type SyncIndicatorProps = {
  className?: string;
  /** Si se indica, el detalle se filtra a esa etapa; el sync sigue drenando la cola real. */
  stageId?: string;
  /** Callback opcional tras drenar (p. ej. refrescar estado de la pantalla). */
  onAfterSync?: () => Promise<void> | void;
};

export function SyncIndicator({ className = "", stageId, onAfterSync }: SyncIndicatorProps) {
  const { connectivityState } = useNetworkStatus();
  const { userId, metrics, totalOpen, refresh } = useOfflineSyncSummary();
  const [isDraining, setIsDraining] = useState(false);
  const hasConflicts = metrics.conflictCount > 0 || metrics.failedCount > 0;
  const isSyncing = isDraining || metrics.syncingCount > 0;
  const title = hasConflicts
    ? `${metrics.conflictCount + metrics.failedCount} conflicto(s) de sincronización`
    : isSyncing
      ? `Sincronizando ${Math.max(metrics.syncingCount, 1)} cambio(s)…`
      : metrics.pendingCount > 0
        ? `${metrics.pendingCount} cambio(s) pendientes`
        : "Sincronización al día";

  const runSync = useCallback(async () => {
    if (!userId || isDraining) return;
    if (connectivityState !== "ONLINE") {
      await refresh();
      return;
    }

    setIsDraining(true);
    try {
      await syncAllPendingForUser(userId);
      await onAfterSync?.();
    } finally {
      await refresh();
      setIsDraining(false);
    }
  }, [connectivityState, isDraining, onAfterSync, refresh, userId]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={title}
            title={title}
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300",
              hasConflicts
                ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                : isSyncing
                  ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                  : totalOpen > 0
                    ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white",
              className
            )}
          >
            <RefreshCw className={cn("size-4 shrink-0", isSyncing && "animate-spin")} />
            {totalOpen > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold text-white">
                {totalOpen > 9 ? "9+" : totalOpen}
              </span>
            )}
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-auto p-0">
        {userId ? (
          <OfflineMutationCenter userId={userId} stageId={stageId} onSync={runSync} />
        ) : (
          <div className="w-72 p-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-950">Sincronizador</p>
            <p className="mt-1 text-xs">
              No hay una sesión offline confiable en este dispositivo. Inicia sesión en staff para
              sincronizar cambios locales.
            </p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OfflineBanner() {
  const { connectivityState } = useNetworkStatus();
  const { metrics } = useOfflineSyncSummary();

  if (connectivityState === "ONLINE" && metrics.conflictCount === 0 && metrics.failedCount === 0) {
    return null;
  }

  if (connectivityState === "ONLINE" && (metrics.conflictCount > 0 || metrics.failedCount > 0)) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-sm font-medium">
          <TriangleAlert className="size-4 shrink-0" />
          <span>
            Hay {metrics.conflictCount + metrics.failedCount} cambio(s) con conflicto o fallidos en este
            dispositivo. Revísalos en el centro de sincronización.
          </span>
        </div>
      </div>
    );
  }

  const isDegraded = connectivityState === "DEGRADED";
  const Icon = isDegraded ? TriangleAlert : WifiOff;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t px-4 py-3",
        isDegraded
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-red-200 bg-red-50 text-red-800"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-sm font-medium">
        <Icon className="size-4 shrink-0" />
        <span>
          {isDegraded
            ? "La conexión con Pegaso está inestable. Los cambios se guardan en este dispositivo."
            : metrics.pendingCount > 0
              ? `Sin conexión con Pegaso. ${metrics.pendingCount} cambio(s) guardados en este dispositivo.`
              : "Sin conexión con Pegaso. Puedes seguir trabajando; los cambios se sincronizarán al recuperar la API."}
        </span>
      </div>
    </div>
  );
}
