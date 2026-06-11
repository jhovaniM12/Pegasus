import { Hono } from "hono";
import {
  getPersonController,
  listPeopleController
} from "../controllers/people.controller.js";

export const peopleRoutes = new Hono();

peopleRoutes.get("/people", listPeopleController);
peopleRoutes.get("/people/:id", getPersonController);
