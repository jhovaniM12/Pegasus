import type { Context } from "hono";
import { success } from "../../http/lib/http.js";
import { getSessionFromCookie } from "../../http/lib/session.js";
import { getActiveStaffUser } from "../auth/auth.service.js";
import { listStaffCategories } from "./staff.service.js";

export async function listStaffCategoriesController(c: Context) {
  const session = getSessionFromCookie(c);
  const user = await getActiveStaffUser(session.userId);
  const categories = await listStaffCategories(user);

  return c.json(success(categories));
}
