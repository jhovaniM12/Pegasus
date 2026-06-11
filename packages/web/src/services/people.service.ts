import { ApiService } from "@/services/api.service";
import type { PaginatedResponse } from "@/types/common";
import type { Person } from "@/types/people";

export class PeopleService extends ApiService {
  async listPeople(): Promise<PaginatedResponse<Person>> {
    return this.get<PaginatedResponse<Person>>("/api/people");
  }
}

export const peopleService = new PeopleService();

