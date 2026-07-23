"use client";

import { useCallback, useEffect, useState } from "react";

import { listMutationsForUser, getTrustedOfflineDevice } from "@/offline/offline-repository";
import { recordOfflineTelemetry } from "@/offline/telemetry";

type WaitingRegistration = ServiceWorkerRegistration & {
  waiting: ServiceWorker | null;
};

export function useServiceWorkerUpdate() {
  const [waitingRegistration, setWaitingRegistration] = useState<WaitingRegistration | null>(null);
  const [hasPendingMutations, setHasPendingMutations] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let disposed = false;

    const refreshPending = async () => {
      const trusted = await getTrustedOfflineDevice();
      if (!trusted) {
        if (!disposed) setHasPendingMutations(false);
        return;
      }
      const mutations = await listMutationsForUser(trusted.userId);
      if (!disposed) setHasPendingMutations(mutations.length > 0);
    };

    const trackRegistration = async () => {
      const registration = await navigator.serviceWorker.getRegistration("/");
      if (!registration || disposed) return;

      const updateWaiting = () => {
        if (registration.waiting) {
          setWaitingRegistration(registration as WaitingRegistration);
          void refreshPending();
        }
      };

      updateWaiting();
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            updateWaiting();
          }
        });
      });
    };

    void trackRegistration();
    void navigator.serviceWorker.ready.then(() => {
      void navigator.serviceWorker.getRegistration("/")?.then((registration) => {
        void registration?.update();
      });
    });

    const onControllerChange = () => {
      // Nueva versión activa: recargar para tomar assets nuevos.
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    if (!waitingRegistration?.waiting) return;

    if (hasPendingMutations) {
      recordOfflineTelemetry("OFFLINE_SW_UPDATE_DEFERRED", {
        pendingCount: 1,
        resultCode: "PENDING_MUTATIONS",
      });
    }

    recordOfflineTelemetry("OFFLINE_SW_UPDATE_APPLIED", {
      resultCode: hasPendingMutations ? "WITH_PENDING" : "CLEAN",
    });
    waitingRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
  }, [hasPendingMutations, waitingRegistration]);

  const dismiss = useCallback(() => {
    setWaitingRegistration(null);
  }, []);

  return {
    updateAvailable: waitingRegistration?.waiting != null,
    hasPendingMutations,
    applyUpdate,
    dismiss,
  };
}
