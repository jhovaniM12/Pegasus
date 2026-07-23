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
import { TriangleAlert, Wifi, WifiOff } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  checkPegasusConnectivity,
  type ConnectivityState,
} from "@/offline/connectivity";

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
        "flex h-10 w-10 items-center justify-center rounded-lg border",
        isOnline
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : isDegraded
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-red-200 bg-red-50 text-red-700",
        className
      )}
      title={title}
    >
      <Icon className="size-4 shrink-0" />
    </div>
  );
}

function OfflineBanner() {
  const { connectivityState } = useNetworkStatus();

  if (connectivityState === "ONLINE") {
    return null;
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
            ? "La conexión con Pegaso está inestable. Esperando confirmación de la API."
            : "Sin conexión con Pegaso. Los cambios offline aún no están habilitados."}
        </span>
      </div>
    </div>
  );
}
