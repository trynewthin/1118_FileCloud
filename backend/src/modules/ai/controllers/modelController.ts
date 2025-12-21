import type { Request, Response } from "express";
import {
  listAiChatModels,
  createAiChatModel,
  updateAiChatModel,
  deleteAiChatModel,
} from "../service.ts";

/**
 * 模型管理控制器
 */

// 获取模型列表
export const listModels = (_req: Request, res: Response) => {
  const items = listAiChatModels();
  return res.json({ items });
};

// 创建模型
export const createModel = (req: Request, res: Response) => {
  const {
    key,
    displayName,
    providerId,
    modelName,
    apiMode,
    capabilities,
    defaultMaxContextMessages,
    allowOverrideContextLimit,
    isEnabled,
  } = req.body as any;

  if (!key || !displayName || !modelName || !apiMode) {
    return res.status(400).json({ message: "缺少必要参数" });
  }

  const model = createAiChatModel({
    key,
    displayName,
    providerId: providerId ?? null,
    modelName,
    apiMode,
    capabilities: capabilities ?? [],
    defaultMaxContextMessages: defaultMaxContextMessages ?? null,
    allowOverrideContextLimit: allowOverrideContextLimit ?? true,
    isEnabled: isEnabled ?? true,
  });

  return res.status(201).json({ model });
};

// 更新模型
export const updateModel = (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "模型 ID 不合法" });
  }

  const model = updateAiChatModel(id, req.body ?? {});
  if (!model) {
    return res.status(404).json({ message: "模型不存在" });
  }

  return res.json({ model });
};

// 删除模型
export const deleteModel = (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "模型 ID 不合法" });
  }

  const ok = deleteAiChatModel(id);
  if (!ok) {
    return res.status(404).json({ message: "模型不存在" });
  }

  return res.status(204).send();
};
