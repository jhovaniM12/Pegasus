"use client";

import { useEffect, useState } from "react";
import { horsesService } from "@/services/horses.service";
import type { PaginationMeta } from "@/types/common";
import type { Horse } from "@/types/horses";

const emptyMeta: PaginationMeta = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
};

export function useHorses(params: { page: number; limit: number; search?: string }) {
  const requestKey = [params.page, params.limit, params.search ?? ""].join(":");
  const [horses, setHorses] = useState<Horse[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ ...emptyMeta, limit: params.limit });
  const [loadedKey, setLoadedKey] = useState("");

  useEffect(() => {
    let cancelled = false;

    horsesService
      .listHorses({
        page: params.page,
        limit: params.limit,
        search: params.search,
      })
      .then((response) => {
        if (cancelled) return;
        setHorses(response.data || []);
        setMeta(response.meta || { ...emptyMeta, limit: params.limit });
        setLoadedKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
  }, [params.page, params.limit, params.search, requestKey]);

  return { horses, meta, loading: loadedKey !== requestKey };
}
