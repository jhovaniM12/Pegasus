export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  data?: T[];
  meta?: PaginationMeta;
};

export type ApiResponse<T> = {
  data?: T;
};

