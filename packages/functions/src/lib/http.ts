export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type SuccessResponse<T> = {
  success: true;
  data: T;
  meta?: PaginationMeta;
};

export type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function success<T>(data: T, meta?: PaginationMeta): SuccessResponse<T> {
  return meta ? { success: true, data, meta } : { success: true, data };
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
