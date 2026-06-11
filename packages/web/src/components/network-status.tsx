"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Wifi, WifiOff } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type NetworkStatusContextValue = {
  isOnline: boolean;
};

const NetworkStatusContext = createContext<NetworkStatusContextValue | null>(null);
const CONNECTIVITY_CHECK_URL = "https://www.gstatic.com/generate_204";
const CONNECTIVITY_CHECK_INTERVAL_MS = 5000;
const CONNECTIVITY_CHECK_TIMEOUT_MS = 3500;

async function checkInternetConnection(): Promise<boolean> {
  if (!navigator.onLine) {
    return false;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CONNECTIVITY_CHECK_TIMEOUT_MS);

  try {
    await fetch(`${CONNECTIVITY_CHECK_URL}?t=${Date.now()}`, {
      cache: "no-store",
      mode: "no-cors",
      signal: controller.signal,
    });

    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(true);
  const hasMounted = useRef(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    let isDisposed = false;

    const updateStatus = async () => {
      const nextIsOnline = await checkInternetConnection();

      if (isDisposed) {
        return;
      }

      setIsOnline(nextIsOnline);

      if (!hasMounted.current) {
        hasMounted.current = true;
        wasOffline.current = !nextIsOnline;
        return;
      }

      if (!nextIsOnline) {
        if (!wasOffline.current) {
          toast({
            variant: "error",
            title: "Sin conexión",
            description: "Estás en modo offline. Algunas acciones pueden no estar disponibles.",
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
    document.addEventListener("visibilitychange", updateStatus);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
      window.removeEventListener("focus", updateStatus);
      document.removeEventListener("visibilitychange", updateStatus);
    };
  }, [toast]);

  const value = useMemo(() => ({ isOnline }), [isOnline]);

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
  const { isOnline } = useNetworkStatus();
  const Icon = isOnline ? Wifi : WifiOff;

  return (
    <div
      className={cn(
        "flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium",
        isOnline
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700",
        className
      )}
      title={isOnline ? "Conectado a internet" : "Sin conexión a internet"}
    >
      <Icon className="size-4 shrink-0" />
      <span className="hidden md:inline">{isOnline ? "Online" : "Offline"}</span>
    </div>
  );
}

function OfflineBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-red-200 bg-red-50 px-4 py-3 text-red-800 shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-sm font-medium">
        <WifiOff className="size-4 shrink-0" />
        <span>Sin conexión a internet. Estás en modo offline.</span>
      </div>
    </div>
  );
}
