import express from "express";
import type { Request, Response } from "express";
import { authRouter } from "./modules/auth/router.ts";
import { fileLibrariesRouter } from "./modules/fileLibraries/router.ts";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRouter);
app.use("/api/file-libraries", fileLibrariesRouter);

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

export { app };
