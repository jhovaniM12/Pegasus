import type { Context } from "hono";
import { success } from "../lib/http.js";
import { getSessionFromCookie } from "../lib/session.js";
import { getActiveStaffUser } from "../services/auth.service.js";
import { listStaffCategories } from "../services/staff.service.js";

export async function listStaffCategoriesController(c: Context) {
  const session = getSessionFromCookie(c);
  const user = await getActiveStaffUser(session.userId);
  const categories = await listStaffCategories(user);

  return c.json(success(categories));
}
