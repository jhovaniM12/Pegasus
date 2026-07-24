import type { Context } from "hono";
import { buildPaginationMeta, success } from "../lib/http.js";
import { parsePaginationQuery } from "../lib/pagination.js";
import { toPersonDto } from "../mappers/person.mapper.js";
import { toUserDto } from "../mappers/user.mapper.js";
import { uuidParamSchema } from "../schemas/common.schema.js";
import {
  assignAccessCodeSchema,
  checkAccessCodeQuerySchema,
  peopleQuerySchema
} from "../schemas/people.schema.js";
import {
  assignPersonAccessCode,
  checkAccessCodeAvailability,
  generatePersonAccessCode,
  getPersonById,
  listPeople
} from "../services/people.service.js";

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

export async function checkAccessCodeController(c: Context) {
  const query = checkAccessCodeQuerySchema.parse(c.req.query());
  const result = await checkAccessCodeAvailability(query.accessCode, query.personId);

  return c.json(success(result));
}

export async function assignPersonAccessCodeController(c: Context) {
  const { id } = uuidParamSchema.parse(c.req.param());
  const body = assignAccessCodeSchema.parse(await c.req.json());
  const user = await assignPersonAccessCode(id, body.accessCode);

  return c.json(
    success({
      ...toUserDto(user),
      accessCode: user.accessCode
    })
  );
}

export async function generatePersonAccessCodeController(c: Context) {
  const { id } = uuidParamSchema.parse(c.req.param());
  const user = await generatePersonAccessCode(id);

  return c.json(
    success({
      ...toUserDto(user),
      accessCode: user.accessCode
    })
  );
}
