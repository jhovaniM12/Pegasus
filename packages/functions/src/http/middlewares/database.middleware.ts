import { getDataSource } from "@pegasus/core";
import type { MiddlewareHandler } from "hono";

export const databaseMiddleware: MiddlewareHandler = async (_c, next) => {
  await getDataSource();
  await next();
};
