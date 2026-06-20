import { useCallback, useEffect, useState } from "react";

import { fairsService } from "@/services/fairs.service";
import type { PaginationMeta } from "@/types/common";
import type {
  Fair,
  FairDetail,
  FairEntriesGaitSummary,
  FairEntry,
  FairResult,
  FairStaff,
} from "@/types/fairs";

const emptyMeta: PaginationMeta = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
};

type UseFairEntriesParams = {
  categoryId: string | null;
  limit: number;
  search?: string;
};

type UseFairResultsParams = {
  categoryId: string | null;
  limit: number;
};

type UseFairStaffParams = {
  limit: number;
};

export function useFairs() {
  const [fairs, setFairs] = useState<Fair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fairsService
      .listFairs()
      .then((data) => {
        setFairs(data.data || []);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { fairs, loading };
}

export function useFairDetail(fairId: string) {
  const [fair, setFair] = useState<FairDetail | null>(null);
  const [entriesSummary, setEntriesSummary] = useState<FairEntriesGaitSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fairsService.getFair(fairId),
      fairsService.getEntriesSummary(fairId),
    ]).then(([fairData, entriesSummaryData]) => {
      setFair(fairData.data || null);
      setEntriesSummary(entriesSummaryData.data || []);
      setLoading(false);
    });
  }, [fairId]);

  return { fair, entriesSummary, loading };
}

export function useFairEntries(fairId: string, params: UseFairEntriesParams) {
  const filterKey = params.categoryId
    ? [fairId, params.categoryId, params.search || ""].join(":")
    : "";
  const [pageByFilter, setPageByFilter] = useState<Record<string, number>>({});
  const [entries, setEntries] = useState<FairEntry[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ ...emptyMeta, limit: params.limit });
  const [loadedKey, setLoadedKey] = useState("");

  const page = filterKey ? (pageByFilter[filterKey] ?? 1) : 1;
  const setPage = useCallback(
    (nextPage: number) => {
      if (!filterKey) return;
      setPageByFilter((current) => ({ ...current, [filterKey]: nextPage }));
    },
    [filterKey]
  );

  const requestKey = filterKey ? [filterKey, params.limit, page].join(":") : "";

  useEffect(() => {
    if (!params.categoryId) {
      return;
    }

    fairsService
      .listEntries(fairId, {
        page,
        limit: params.limit,
        categoryId: params.categoryId,
        search: params.search,
      })
      .then((data) => {
        setEntries(data.data || []);
        setMeta(data.meta || { ...emptyMeta, limit: params.limit });
        setLoadedKey(requestKey);
      });
  }, [fairId, filterKey, params.categoryId, params.limit, page, params.search, requestKey]);

  return {
    entries: params.categoryId ? entries : [],
    meta: params.categoryId ? meta : { ...emptyMeta, limit: params.limit },
    loading: Boolean(params.categoryId) && loadedKey !== requestKey,
    page,
    setPage,
  };
}

export function useFairResults(fairId: string, params: UseFairResultsParams) {
  const filterKey = params.categoryId ? [fairId, params.categoryId].join(":") : "";
  const [pageByFilter, setPageByFilter] = useState<Record<string, number>>({});
  const [results, setResults] = useState<FairResult[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ ...emptyMeta, limit: params.limit });
  const [loadedKey, setLoadedKey] = useState("");

  const page = filterKey ? (pageByFilter[filterKey] ?? 1) : 1;
  const setPage = useCallback(
    (nextPage: number) => {
      if (!filterKey) return;
      setPageByFilter((current) => ({ ...current, [filterKey]: nextPage }));
    },
    [filterKey]
  );

  const requestKey = filterKey ? [filterKey, params.limit, page].join(":") : "";

  useEffect(() => {
    if (!params.categoryId) {
      return;
    }

    fairsService
      .listResults(fairId, {
        page,
        limit: params.limit,
        categoryId: params.categoryId,
      })
      .then((data) => {
        setResults(data.data || []);
        setMeta(data.meta || { ...emptyMeta, limit: params.limit });
        setLoadedKey(requestKey);
      });
  }, [fairId, filterKey, params.categoryId, params.limit, page, requestKey]);

  return {
    results: params.categoryId ? results : [],
    meta: params.categoryId ? meta : { ...emptyMeta, limit: params.limit },
    loading: Boolean(params.categoryId) && loadedKey !== requestKey,
    page,
    setPage,
  };
}

export function useFairStaff(fairId: string, params: UseFairStaffParams) {
  const filterKey = fairId;
  const [pageByFilter, setPageByFilter] = useState<Record<string, number>>({});
  const [staff, setStaff] = useState<FairStaff[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ ...emptyMeta, limit: params.limit });
  const [loadedKey, setLoadedKey] = useState("");

  const page = pageByFilter[filterKey] ?? 1;
  const setPage = useCallback(
    (nextPage: number) => {
      setPageByFilter((current) => ({ ...current, [filterKey]: nextPage }));
    },
    [filterKey]
  );

  const requestKey = [filterKey, params.limit, page].join(":");

  useEffect(() => {
    fairsService
      .listStaff(fairId, {
        page,
        limit: params.limit,
      })
      .then((data) => {
        setStaff(data.data || []);
        setMeta(data.meta || { ...emptyMeta, limit: params.limit });
        setLoadedKey(requestKey);
      });
  }, [fairId, filterKey, params.limit, page, requestKey]);

  return { staff, meta, loading: loadedKey !== requestKey, page, setPage };
}
