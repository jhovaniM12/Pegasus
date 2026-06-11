import {
  findPeoplePaginated,
  findPersonById,
  getDataSource,
  type PaginatedResult,
  type PaginationParams,
  type Person
} from "@pegasus/core";
import { NotFoundError } from "../lib/errors.js";

export async function listPeople(
  params: PaginationParams & { search?: string }
): Promise<PaginatedResult<Person>> {
  const dataSource = await getDataSource();
  return findPeoplePaginated(dataSource, params);
}

export async function getPersonById(personId: string): Promise<Person> {
  const dataSource = await getDataSource();
  const person = await findPersonById(dataSource, personId);

  if (!person) {
    throw new NotFoundError(`No se encontró la persona con id "${personId}".`);
  }

  return person;
}
