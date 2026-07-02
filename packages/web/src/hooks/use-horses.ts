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
  const [horses, setHorses] = useState<Horse[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ ...emptyMeta, limit: params.limit });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    horsesService
      .listHorses(params)
      .then((response) => {
        setHorses(response.data || []);
        setMeta(response.meta || { ...emptyMeta, limit: params.limit });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [params.page, params.limit, params.search]);

  return { horses, meta, loading };
}
