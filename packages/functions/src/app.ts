import { Hono } from "hono";
import { cors } from "hono/cors";
import { databaseMiddleware } from "./http/middlewares/database.middleware.js";
import { errorHandler } from "./http/middlewares/error-handler.middleware.js";
import { requireRootSession, requireStaffSession } from "./http/middlewares/auth.middleware.js";
import { awardDistinctivesRoutes } from "./domains/judging/award-distinctives.routes.js";
import { authRoutes } from "./domains/auth/auth.routes.js";
import { categoriesRoutes } from "./domains/categories/categories.routes.js";
import { dashboardRoutes } from "./domains/dashboard/dashboard.routes.js";
import { fairsRoutes } from "./domains/fairs/fairs.routes.js";
import { healthRoutes } from "./domains/health/health.routes.js";
import { horsesRoutes } from "./domains/horses/horses.routes.js";
import { judgingRemindersRoutes } from "./domains/judging/judging-reminders.routes.js";
import { peopleRoutes } from "./domains/people/people.routes.js";
import { staffRoutes } from "./domains/staff/staff.routes.js";
import { stagedFlowRoutes } from "./domains/judging/staged-flow.routes.js";
import { syncRoutes } from "./domains/sync/sync.routes.js";
import { systemSettingsRoutes } from "./domains/system/system-settings.routes.js";

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
app.use("/horses", requireRootSession);
app.use("/horses/*", requireRootSession);
app.use("/judging-reminders", requireRootSession);
app.use("/judging-reminders/*", requireRootSession);
app.use("/dashboard", requireRootSession);
app.use("/dashboard/*", requireRootSession);
app.use("/sync", requireRootSession);
app.use("/sync/*", requireRootSession);
app.use("/staff", requireStaffSession);
app.use("/staff/*", requireStaffSession);
app.route("/", fairsRoutes);
app.route("/", categoriesRoutes);
app.route("/", peopleRoutes);
app.route("/", horsesRoutes);
app.route("/", judgingRemindersRoutes);
app.route("/", dashboardRoutes);
app.route("/", awardDistinctivesRoutes);
app.route("/", staffRoutes);
app.route("/", stagedFlowRoutes);
app.route("/", systemSettingsRoutes);
app.route("/", syncRoutes);
