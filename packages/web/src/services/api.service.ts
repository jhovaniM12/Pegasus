import axios from "axios";

type ApiErrorPayload = {
  error?: {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
  message?: unknown;
};

export class ApiError extends Error {
  readonly status: number | null;
  readonly code: string | null;
  readonly details: unknown;

  constructor(message: string, options: { status?: number | null; code?: string | null; details?: unknown } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.details = options.details;
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

function notifyUnauthorized() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("pegasus:unauthorized"));
}

function buildApiError(error: unknown, fallbackMessage: string): ApiError {
  if (!axios.isAxiosError(error)) {
    return error instanceof ApiError
      ? error
      : new ApiError(error instanceof Error ? error.message : fallbackMessage);
  }

  const status = error.response?.status ?? null;
  const payload = error.response?.data as ApiErrorPayload | undefined;
  const backendMessage =
    typeof payload?.error?.message === "string"
      ? payload.error.message
      : typeof payload?.message === "string"
        ? payload.message
        : null;
  const code = typeof payload?.error?.code === "string" ? payload.error.code : null;
  const message = backendMessage ?? (status === 401 ? "Sesión expirada. Vuelve a ingresar." : fallbackMessage);

  if (status === 401) {
    notifyUnauthorized();
  }

  return new ApiError(message, {
    status,
    code,
    details: payload?.error?.details,
  });
}

export class ApiService {
  protected async get<T>(url: string): Promise<T> {
    try {
      const response = await axios.get<T>(url);
      return response.data;
    } catch (error) {
      throw buildApiError(error, `Error al consultar ${url}.`);
    }
  }

  protected async post<T>(url: string, body?: unknown): Promise<T> {
    try {
      const response = await axios.post<T>(url, body);
      return response.data;
    } catch (error) {
      throw buildApiError(error, `Error al enviar ${url}.`);
    }
  }

  protected async patch<T>(url: string, body?: unknown): Promise<T> {
    try {
      const response = await axios.patch<T>(url, body);
      return response.data;
    } catch (error) {
      throw buildApiError(error, `Error al actualizar ${url}.`);
    }
  }

  protected async delete<T>(url: string): Promise<T> {
    try {
      const response = await axios.delete<T>(url);
      return response.data;
    } catch (error) {
      throw buildApiError(error, `Error al eliminar ${url}.`);
    }
  }

  protected async put<T>(url: string, body?: unknown): Promise<T> {
    try {
      const response = await axios.put<T>(url, body);
      return response.data;
    } catch (error) {
      throw buildApiError(error, `Error al guardar ${url}.`);
    }
  }

  protected buildQuery(params: Record<string, string | number | null | undefined>): string {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    }

    return query.toString();
  }
}
