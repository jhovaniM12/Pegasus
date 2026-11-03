import { Hono } from "hono";
import { listStaffCategoriesController } from "./staff.controller.js";

export const staffRoutes = new Hono();

staffRoutes.get("/staff/categories", listStaffCategoriesController);
