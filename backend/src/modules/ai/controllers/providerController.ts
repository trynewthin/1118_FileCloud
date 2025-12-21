import type { Request, Response } from "express";
import {
  listAiProviders,
  createAiProvider,
  updateAiProvider,
  deleteAiProvider,
} from "../service.ts";

/**
 * 供应商管理控制器
 */

// 获取供应商列表
export const listProviders = (_req: Request, res: Response) => {
  const items = listAiProviders();
  return res.json({ items });
};

// 创建供应商
export const createProvider = (req: Request, res: Response) => {
  const { name, baseUrl, apiKey, apiType, extraHeadersJson, timeoutMs } = req.body as {
    name?: string;
    baseUrl?: string;
    apiKey?: string | null;
    apiType?: string;
    extraHeadersJson?: string | null;
    timeoutMs?: number | null;
  };

  if (!name || !baseUrl || !apiType) {
    return res.status(400).json({ message: "缺少必要参数" });
  }

  const provider = createAiProvider({
    name,
    baseUrl,
    apiKey: apiKey ?? null,
    apiType,
    extraHeadersJson: extraHeadersJson ?? null,
    timeoutMs: timeoutMs ?? null,
  });

  return res.status(201).json({ provider });
};

// 更新供应商
export const updateProvider = (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "供应商 ID 不合法" });
  }

  const provider = updateAiProvider(id, req.body ?? {});
  if (!provider) {
    return res.status(404).json({ message: "供应商不存在" });
  }

  return res.json({ provider });
};

// 删除供应商
export const deleteProvider = (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "供应商 ID 不合法" });
  }

  const ok = deleteAiProvider(id);
  if (!ok) {
    return res.status(404).json({ message: "供应商不存在" });
  }

  return res.status(204).send();
};
