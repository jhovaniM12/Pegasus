import type { Context } from "hono";
import { z } from "zod";
import { success } from "../../http/lib/http.js";
import { respondWithPaginatedList } from "../../http/lib/paginated-response.js";
import { toCategoryDto } from "./category.mapper.js";
import { uuidParamSchema } from "../../shared/common.schema.js";
import { getCategoryById, listCategories, listCategoryGaits } from "./categories.service.js";

const categoriesQuerySchema = z.object({
  gaitId: z.string().uuid("El identificador de andar debe ser un UUID válido.").optional()
});

export async function listCategoriesController(c: Context) {
  const { gaitId } = categoriesQuerySchema.parse({
    gaitId: c.req.query("gaitId")
  });

  return respondWithPaginatedList(
    c,
    (pagination) => listCategories({ ...pagination, gaitId }),
    toCategoryDto
  );
}

export async function listCategoryGaitsController(c: Context) {
  const gaits = await listCategoryGaits();

  return c.json(success(gaits));
}

export async function getCategoryController(c: Context) {
  const { id } = uuidParamSchema.parse(c.req.param());
  const category = await getCategoryById(id);

  return c.json(success(toCategoryDto(category)));
}
