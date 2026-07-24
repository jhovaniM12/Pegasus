import { ApiService } from "@/services/api.service";
import type { ApiResponse, PaginatedResponse } from "@/types/common";
import type { Person } from "@/types/people";

export type ListPeopleParams = {
  fairId?: string;
  limit?: number;
};

export type AccessCodeAvailability = {
  accessCode: string;
  available: boolean;
  message: string;
};

export type AccessCodeAssignment = {
  role: string;
  accessCode: string | null;
};

export class PeopleService extends ApiService {
  async listPeople(params: ListPeopleParams = {}): Promise<PaginatedResponse<Person>> {
    const query = new URLSearchParams();

    if (params.fairId) {
      query.set("fairId", params.fairId);
    }

    query.set("limit", String(params.limit ?? 100));

    return this.get<PaginatedResponse<Person>>(`/api/people?${query.toString()}`);
  }

  async checkAccessCode(
    accessCode: string,
    personId?: string
  ): Promise<ApiResponse<AccessCodeAvailability>> {
    const query = new URLSearchParams({ accessCode });

    if (personId) {
      query.set("personId", personId);
    }

    return this.get<ApiResponse<AccessCodeAvailability>>(
      `/api/people/access-code/check?${query.toString()}`
    );
  }

  async assignAccessCode(
    personId: string,
    accessCode: string
  ): Promise<ApiResponse<AccessCodeAssignment>> {
    return this.patch<ApiResponse<AccessCodeAssignment>>(`/api/people/${personId}/access-code`, {
      accessCode,
    });
  }

  async generateAccessCode(personId: string): Promise<ApiResponse<AccessCodeAssignment>> {
    return this.post<ApiResponse<AccessCodeAssignment>>(
      `/api/people/${personId}/access-code/generate`
    );
  }
}

export const peopleService = new PeopleService();
