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

export type ConnectivityState = "ONLINE" | "OFFLINE" | "DEGRADED";

async function checkPegasusConnectivity(): Promise<boolean> {
  if (!navigator.onLine) return false;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`/api/health?t=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { success?: unknown; status?: unknown };
    return body.success === true && body.status === "healthy";
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

type NetworkStatusContextValue = {
  isOnline: boolean;
  connectivityState: ConnectivityState;
  checkNow: () => Promise<ConnectivityState>;
};

const NetworkStatusContext = createContext<NetworkStatusContextValue | null>(null);

export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [connectivityState, setConnectivityState] = useState<ConnectivityState>("DEGRADED");
  const failuresRef = useRef(0);
  const previousRef = useRef<ConnectivityState | null>(null);

  const checkNow = useCallback(async (): Promise<ConnectivityState> => {
    const available = await checkPegasusConnectivity();
    const next = available
      ? "ONLINE"
      : !navigator.onLine || failuresRef.current >= 1
        ? "OFFLINE"
        : "DEGRADED";
    failuresRef.current = available ? 0 : failuresRef.current + 1;
    setConnectivityState(next);
    return next;
  }, []);

  useEffect(() => {
    const update = async () => {
      const next = await checkNow();
      const previous = previousRef.current;
      previousRef.current = next;
      if (previous && previous !== next) {
        toast(
          next === "ONLINE"
            ? { title: "Conexión restaurada", variant: "success" }
            : {
                title: "Sin conexión",
                description: "Los cambios requieren conexión con Pegaso para guardarse.",
                variant: "error",
              }
        );
      }
    };
    void update();
    const intervalId = window.setInterval(() => void update(), 5000);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [checkNow, toast]);

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
      {connectivityState !== "ONLINE" && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-sm font-medium">
            <WifiOff className="size-4 shrink-0" />
            <span>Sin conexión con Pegaso. Los cambios no podrán guardarse hasta recuperarla.</span>
          </div>
        </div>
      )}
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus() {
  const context = useContext(NetworkStatusContext);
  if (!context) throw new Error("useNetworkStatus debe usarse dentro de NetworkStatusProvider.");
  return context;
}

export function ConnectionIndicator({ className = "" }: { className?: string }) {
  const { connectivityState } = useNetworkStatus();
  const online = connectivityState === "ONLINE";
  const degraded = connectivityState === "DEGRADED";
  const Icon = online ? Wifi : degraded ? TriangleAlert : WifiOff;
  const title = online
    ? "Conectado a Pegaso"
    : degraded
      ? "Conexión inestable con Pegaso"
      : "Sin conexión con Pegaso";

  return (
    <div
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-lg border",
        online
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : degraded
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
