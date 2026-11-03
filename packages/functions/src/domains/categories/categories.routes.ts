import { Hono } from "hono";
import {
  getCategoryController,
  listCategoryGaitsController,
  listCategoriesController
} from "./categories.controller.js";

export const categoriesRoutes = new Hono();

categoriesRoutes.get("/categories", listCategoriesController);
categoriesRoutes.get("/categories/gaits", listCategoryGaitsController);
categoriesRoutes.get("/categories/:id", getCategoryController);
