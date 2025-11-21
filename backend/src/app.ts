import express from "express";
import type { Request, Response } from "express";
import { authRouter } from "./modules/auth/router.ts";
import { fileLibrariesRouter } from "./modules/fileLibraries/router.ts";
import { tasksRouter } from "./modules/tasks/router.ts";
import { filesRouter } from "./modules/files/router.ts";
import { fileContentRouter } from "./modules/fileContent/router.ts";
import { activityLogsRouter } from "./modules/activityLogs/router.ts";
import { settingsRouter } from "./modules/settings/router.ts";
import { systemRouter } from "./modules/system/router.ts";
import { aiRouter } from "./modules/ai/router.ts";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const origin = req.headers.origin ?? "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use("/api/auth", authRouter);
app.use("/api/file-libraries", fileLibrariesRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/files", filesRouter);
app.use("/api/file-content", fileContentRouter);
app.use("/api/activity-logs", activityLogsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/system", systemRouter);
app.use("/api/ai", aiRouter);

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

export { app };
