import { Hono } from "hono";
import { cors } from "hono/cors";
import { databaseMiddleware } from "./middlewares/database.middleware.js";
import { errorHandler } from "./middlewares/error-handler.middleware.js";
import { requireRootSession, requireStaffSession } from "./middlewares/auth.middleware.js";
import { awardDistinctivesRoutes } from "./routes/award-distinctives.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { categoriesRoutes } from "./routes/categories.routes.js";
import { fairsRoutes } from "./routes/fairs.routes.js";
import { healthRoutes } from "./routes/health.routes.js";
import { peopleRoutes } from "./routes/people.routes.js";
import { staffRoutes } from "./routes/staff.routes.js";
import { stagedFlowRoutes } from "./routes/staged-flow.routes.js";

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
app.use("/staff", requireStaffSession);
app.use("/staff/*", requireStaffSession);
app.route("/", fairsRoutes);
app.route("/", categoriesRoutes);
app.route("/", peopleRoutes);
app.route("/", awardDistinctivesRoutes);
app.route("/", staffRoutes);
app.route("/", stagedFlowRoutes);
