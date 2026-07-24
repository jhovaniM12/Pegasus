import { Hono } from "hono";
import {
  assignPersonAccessCodeController,
  checkAccessCodeController,
  generatePersonAccessCodeController,
  getPersonController,
  listPeopleController
} from "../controllers/people.controller.js";

export const peopleRoutes = new Hono();

peopleRoutes.get("/people", listPeopleController);
peopleRoutes.get("/people/access-code/check", checkAccessCodeController);
peopleRoutes.get("/people/:id", getPersonController);
peopleRoutes.patch("/people/:id/access-code", assignPersonAccessCodeController);
peopleRoutes.post("/people/:id/access-code/generate", generatePersonAccessCodeController);
