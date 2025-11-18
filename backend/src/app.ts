import express from "express";
import type { Request, Response } from "express";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

export { app };
