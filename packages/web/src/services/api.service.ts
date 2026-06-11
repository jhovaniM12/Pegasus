export class ApiService {
  protected async get<T>(url: string): Promise<T> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Error al consultar ${url}.`);
    }

    return response.json() as Promise<T>;
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

