import { useEffect, useState } from "react";

import { categoriesService } from "@/services/categories.service";
import type { PaginationMeta } from "@/types/common";
import type { Category, GaitOption } from "@/types/categories";

const emptyMeta: PaginationMeta = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
};

type UseCategoriesParams = {
  page: number;
  limit: number;
  gaitId?: string;
};

export function useCategoryGaits() {
  const [gaits, setGaits] = useState<GaitOption[]>([]);

  useEffect(() => {
    categoriesService.listGaits().then((data) => {
      setGaits(data.data || []);
    });
  }, []);

  return { gaits };
}

export function useCategories(params: UseCategoriesParams) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ ...emptyMeta, limit: params.limit });
  const [loadedKey, setLoadedKey] = useState("");
  const requestKey = [params.gaitId || "", params.limit, params.page].join(":");

  useEffect(() => {
    categoriesService
      .listCategories({
        page: params.page,
        limit: params.limit,
        gaitId: params.gaitId,
      })
      .then((data) => {
        setCategories(data.data || []);
        setMeta(data.meta || { ...emptyMeta, limit: params.limit });
        setLoadedKey(requestKey);
      });
  }, [params.gaitId, params.limit, params.page, requestKey]);

  return { categories, meta, loading: loadedKey !== requestKey };
}
