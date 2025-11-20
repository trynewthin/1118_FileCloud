import express from "express";
import type { Request, Response } from "express";
import { authRouter } from "./modules/auth/router.ts";
import { fileLibrariesRouter } from "./modules/fileLibraries/router.ts";
import { tasksRouter } from "./modules/tasks/router.ts";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRouter);
app.use("/api/file-libraries", fileLibrariesRouter);
app.use("/api/tasks", tasksRouter);

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

export { app };
