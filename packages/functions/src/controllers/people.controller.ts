import type { Context } from "hono";
import { buildPaginationMeta, success } from "../lib/http.js";
import { parsePaginationQuery } from "../lib/pagination.js";
import { toPersonDto } from "../mappers/person.mapper.js";
import { toUserDto } from "../mappers/user.mapper.js";
import { uuidParamSchema } from "../schemas/common.schema.js";
import { assignAccessCodeSchema, peopleQuerySchema } from "../schemas/people.schema.js";
import { assignPersonAccessCode, getPersonById, listPeople } from "../services/people.service.js";

export async function listPeopleController(c: Context) {
  const pagination = parsePaginationQuery(c.req.query());
  const query = peopleQuerySchema.parse(c.req.query());
  const result = await listPeople({
    ...pagination,
    search: query.search,
    fairId: query.fairId
  });

  return c.json(
    success(
      result.items.map(toPersonDto),
      buildPaginationMeta(result.page, result.limit, result.total)
    )
  );
}

export async function getPersonController(c: Context) {
  const { id } = uuidParamSchema.parse(c.req.param());
  const person = await getPersonById(id);

  return c.json(success(toPersonDto(person)));
}

export async function assignPersonAccessCodeController(c: Context) {
  const { id } = uuidParamSchema.parse(c.req.param());
  const body = assignAccessCodeSchema.parse(await c.req.json());
  const user = await assignPersonAccessCode(id, body.accessCode);

  return c.json(success(toUserDto(user)));
}
