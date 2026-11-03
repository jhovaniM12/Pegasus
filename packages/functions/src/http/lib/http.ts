export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type MutationSyncMeta = {
  operationId: string;
  applied: boolean;
  duplicate: boolean;
  revision: number;
  serverUpdatedAt: string;
};

export type SuccessResponse<T> = {
  success: true;
  data: T;
  meta?: PaginationMeta;
  sync?: MutationSyncMeta;
};

export type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function success<T>(
  data: T,
  meta?: PaginationMeta,
  sync?: MutationSyncMeta
): SuccessResponse<T> {
  return {
    success: true,
    data,
    ...(meta ? { meta } : {}),
    ...(sync ? { sync } : {})
  };
}

export function error(code: string, message: string, details?: unknown): ErrorResponse {
  return {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details }
  };
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit)
  };
}
