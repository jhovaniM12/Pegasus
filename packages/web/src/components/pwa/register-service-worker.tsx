"use client";

import { useEffect } from "react";

const SERVICE_WORKER_URL = "/service-worker.js";

/**
 * Registers the existing Pusher Beams service worker early so the app meets
 * PWA install criteria without changing push notification behavior.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .register(SERVICE_WORKER_URL, { scope: "/" })
      .catch(() => {
        // Beams may register the same worker later during push activation.
      });
  }, []);

  return null;
}
