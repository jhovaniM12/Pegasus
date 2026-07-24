import { ApiService } from "@/services/api.service";
import type { ApiResponse, PaginatedResponse } from "@/types/common";
import type { Person } from "@/types/people";

export type ListPeopleParams = {
  fairId?: string;
};

export class PeopleService extends ApiService {
  async listPeople(params: ListPeopleParams = {}): Promise<PaginatedResponse<Person>> {
    const query = new URLSearchParams();

    if (params.fairId) {
      query.set("fairId", params.fairId);
    }

    const suffix = query.toString() ? `?${query.toString()}` : "";
    return this.get<PaginatedResponse<Person>>(`/api/people${suffix}`);
  }

  async assignAccessCode(personId: string, accessCode: string): Promise<ApiResponse<{ role: string }>> {
    return this.patch<ApiResponse<{ role: string }>>(`/api/people/${personId}/access-code`, {
      accessCode,
    });
  }
}

export const peopleService = new PeopleService();
