import { Hono } from "hono";
import { cors } from "hono/cors";
import { databaseMiddleware } from "./middlewares/database.middleware.js";
import { errorHandler } from "./middlewares/error-handler.middleware.js";
import { requireRootSession } from "./middlewares/auth.middleware.js";
import { authRoutes } from "./routes/auth.routes.js";
import { categoriesRoutes } from "./routes/categories.routes.js";
import { fairsRoutes } from "./routes/fairs.routes.js";
import { healthRoutes } from "./routes/health.routes.js";
import { peopleRoutes } from "./routes/people.routes.js";

export const app = new Hono().basePath("/api");

app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true
  })
);
app.use("*", databaseMiddleware);
app.onError(errorHandler);

app.route("/", healthRoutes);
app.route("/", authRoutes);
app.use("/fairs", requireRootSession);
app.use("/fairs/*", requireRootSession);
app.use("/categories", requireRootSession);
app.use("/categories/*", requireRootSession);
app.use("/people", requireRootSession);
app.use("/people/*", requireRootSession);
app.route("/", fairsRoutes);
app.route("/", categoriesRoutes);
app.route("/", peopleRoutes);
