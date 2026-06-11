import {
  findStaffCategoriesByPersonId,
  getDataSource,
  type StaffCategorySummary,
  type User
} from "@pegasus/core";
import { ForbiddenError } from "../lib/errors.js";

export async function listStaffCategories(user: User): Promise<StaffCategorySummary[]> {
  if (!user.personId) {
    throw new ForbiddenError("El usuario no está asociado a una persona.");
  }

  const dataSource = await getDataSource();

  return findStaffCategoriesByPersonId(dataSource, user.personId);
}
