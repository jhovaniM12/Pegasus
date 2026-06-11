import { Hono } from "hono";
import { listStaffCategoriesController } from "../controllers/staff.controller.js";

export const staffRoutes = new Hono();

staffRoutes.get("/staff/categories", listStaffCategoriesController);
