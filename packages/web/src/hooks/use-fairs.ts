import { useEffect, useState } from "react";

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
  page: number;
  limit: number;
  search?: string;
};

type UseFairResultsParams = {
  categoryId: string | null;
  page: number;
  limit: number;
};

type UseFairStaffParams = {
  page: number;
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
  const [entries, setEntries] = useState<FairEntry[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ ...emptyMeta, limit: params.limit });
  const [loadedKey, setLoadedKey] = useState("");
  const requestKey = params.categoryId
    ? [fairId, params.categoryId, params.limit, params.page, params.search || ""].join(":")
    : "";

  useEffect(() => {
    if (!params.categoryId) {
      return;
    }

    fairsService
      .listEntries(fairId, {
        page: params.page,
        limit: params.limit,
        categoryId: params.categoryId,
        search: params.search,
      })
      .then((data) => {
        setEntries(data.data || []);
        setMeta(data.meta || { ...emptyMeta, limit: params.limit });
        setLoadedKey(requestKey);
      });
  }, [fairId, params.categoryId, params.limit, params.page, params.search, requestKey]);

  return {
    entries: params.categoryId ? entries : [],
    meta: params.categoryId ? meta : { ...emptyMeta, limit: params.limit },
    loading: Boolean(params.categoryId) && loadedKey !== requestKey,
  };
}

export function useFairResults(fairId: string, params: UseFairResultsParams) {
  const [results, setResults] = useState<FairResult[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ ...emptyMeta, limit: params.limit });
  const [loadedKey, setLoadedKey] = useState("");
  const requestKey = params.categoryId
    ? [fairId, params.categoryId, params.limit, params.page].join(":")
    : "";

  useEffect(() => {
    if (!params.categoryId) {
      return;
    }

    fairsService
      .listResults(fairId, {
        page: params.page,
        limit: params.limit,
        categoryId: params.categoryId,
      })
      .then((data) => {
        setResults(data.data || []);
        setMeta(data.meta || { ...emptyMeta, limit: params.limit });
        setLoadedKey(requestKey);
      });
  }, [fairId, params.categoryId, params.limit, params.page, requestKey]);

  return {
    results: params.categoryId ? results : [],
    meta: params.categoryId ? meta : { ...emptyMeta, limit: params.limit },
    loading: Boolean(params.categoryId) && loadedKey !== requestKey,
  };
}

export function useFairStaff(fairId: string, params: UseFairStaffParams) {
  const [staff, setStaff] = useState<FairStaff[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ ...emptyMeta, limit: params.limit });
  const [loadedKey, setLoadedKey] = useState("");
  const requestKey = [fairId, params.limit, params.page].join(":");

  useEffect(() => {
    fairsService
      .listStaff(fairId, {
        page: params.page,
        limit: params.limit,
      })
      .then((data) => {
        setStaff(data.data || []);
        setMeta(data.meta || { ...emptyMeta, limit: params.limit });
        setLoadedKey(requestKey);
      });
  }, [fairId, params.limit, params.page, requestKey]);

  return { staff, meta, loading: loadedKey !== requestKey };
}
