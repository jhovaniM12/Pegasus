"use client";

import { useEffect, useRef } from "react";

type UseStaffRealtimeRefreshOptions = {
  enabled?: boolean;
  pollingMs?: number;
  enableVisibilityRefresh?: boolean;
  refreshWhenHidden?: boolean;
  debounceMs?: number;
};

/**
 * Refresh helper for staff screens triggered by service worker push events.
 * Includes optional visibility and polling fallbacks.
 */
export function useStaffRealtimeRefresh(
  onRefresh: () => void | Promise<void>,
  {
    enabled = true,
    pollingMs,
    enableVisibilityRefresh = false,
    refreshWhenHidden = false,
    debounceMs = 300,
  }: UseStaffRealtimeRefreshOptions = {}
) {
  const refreshRef = useRef(onRefresh);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const queueRefresh = () => {
      if (!refreshWhenHidden && typeof document !== "undefined" && document.hidden) {
        return;
      }

      if (debounceMs <= 0) {
        void refreshRef.current();
        return;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void refreshRef.current();
      }, debounceMs);
    };

    if ("serviceWorker" in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if ((event.data as { type?: string } | null)?.type === "PUSH_RECEIVED") {
          queueRefresh();
        }
      };

      navigator.serviceWorker.addEventListener("message", handleMessage);

      return () => {
        navigator.serviceWorker.removeEventListener("message", handleMessage);
      };
    }
  }, [debounceMs, enabled, refreshWhenHidden]);

  useEffect(() => {
    if (!enabled || !enableVisibilityRefresh || typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.hidden) return;
      void refreshRef.current();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, enableVisibilityRefresh]);

  useEffect(() => {
    if (!enabled || !pollingMs || pollingMs <= 0) return;

    const interval = setInterval(() => {
      if (!refreshWhenHidden && typeof document !== "undefined" && document.hidden) {
        return;
      }
      void refreshRef.current();
    }, pollingMs);

    return () => clearInterval(interval);
  }, [enabled, pollingMs, refreshWhenHidden]);
}
