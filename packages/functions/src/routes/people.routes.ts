import { Hono } from "hono";
import {
  assignPersonAccessCodeController,
  getPersonController,
  listPeopleController
} from "../controllers/people.controller.js";

export const peopleRoutes = new Hono();

peopleRoutes.get("/people", listPeopleController);
peopleRoutes.get("/people/:id", getPersonController);
peopleRoutes.patch("/people/:id/access-code", assignPersonAccessCodeController);
