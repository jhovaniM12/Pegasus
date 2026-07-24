"use client";

import { useEffect, useRef } from "react";
import {
  parseStaffPushMessage,
  type StaffPushMessage,
} from "@/lib/staff-push-message";

type UseStaffRealtimeRefreshOptions = {
  enabled?: boolean;
  pollingMs?: number;
  enableVisibilityRefresh?: boolean;
  refreshWhenHidden?: boolean;
  debounceMs?: number;
  /** Toast / UI inmediata al recibir el payload del push (sin esperar fetch). */
  onPushMessage?: (message: StaffPushMessage) => void;
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
    onPushMessage,
  }: UseStaffRealtimeRefreshOptions = {}
) {
  const refreshRef = useRef(onRefresh);
  const onPushMessageRef = useRef(onPushMessage);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    onPushMessageRef.current = onPushMessage;
  }, [onPushMessage]);

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
        const message = parseStaffPushMessage(event.data);
        if (!message) return;

        onPushMessageRef.current?.(message);
        queueRefresh();
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
