import axios from "axios";

export class ApiService {
  protected async get<T>(url: string): Promise<T> {
    try {
      const response = await axios.get<T>(url);
      return response.data;
    } catch (error) {
      throw new Error(`Error al consultar ${url}.`);
    }
  }

  protected async post<T>(url: string, body?: unknown): Promise<T> {
    try {
      const response = await axios.post<T>(url, body);
      return response.data;
    } catch (error) {
      throw new Error(`Error al enviar ${url}.`);
    }
  }

  protected async patch<T>(url: string, body?: unknown): Promise<T> {
    try {
      const response = await axios.patch<T>(url, body);
      return response.data;
    } catch (error) {
      throw new Error(`Error al actualizar ${url}.`);
    }
  }

  protected async put<T>(url: string, body?: unknown): Promise<T> {
    try {
      const response = await axios.put<T>(url, body);
      return response.data;
    } catch (error) {
      throw new Error(`Error al guardar ${url}.`);
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
