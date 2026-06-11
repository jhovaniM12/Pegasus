import { ApiService } from "@/services/api.service";
import type { ApiResponse, PaginatedResponse } from "@/types/common";
import type { Person } from "@/types/people";

export class PeopleService extends ApiService {
  async listPeople(): Promise<PaginatedResponse<Person>> {
    return this.get<PaginatedResponse<Person>>("/api/people");
  }

  async assignAccessCode(personId: string, accessCode: string): Promise<ApiResponse<{ role: string }>> {
    return this.patch<ApiResponse<{ role: string }>>(`/api/people/${personId}/access-code`, {
      accessCode,
    });
  }
}

export const peopleService = new PeopleService();
