import type { Request, Response } from "express";
import {
  listAiChatPrompts,
  createAiChatPrompt,
  updateAiChatPrompt,
  deleteAiChatPrompt,
} from "../service.ts";

/**
 * 提示词管理控制器
 */

// 获取提示词列表
export const listPrompts = (_req: Request, res: Response) => {
  const items = listAiChatPrompts();
  return res.json({ items });
};

// 创建提示词
export const createPrompt = (req: Request, res: Response) => {
  const { title, content, scope, isDefault } = req.body as {
    title?: string;
    content?: string;
    scope?: string | null;
    isDefault?: boolean;
  };

  if (!title || !content) {
    return res.status(400).json({ message: "提示词标题和内容不能为空" });
  }

  const prompt = createAiChatPrompt({
    title,
    content,
    scope: scope ?? null,
    isDefault: isDefault ?? false,
  });

  return res.status(201).json({ prompt });
};

// 更新提示词
export const updatePrompt = (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "提示词 ID 不合法" });
  }

  const prompt = updateAiChatPrompt(id, req.body ?? {});
  if (!prompt) {
    return res.status(404).json({ message: "提示词不存在" });
  }

  return res.json({ prompt });
};

// 删除提示词
export const deletePrompt = (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "提示词 ID 不合法" });
  }

  const ok = deleteAiChatPrompt(id);
  if (!ok) {
    return res.status(404).json({ message: "提示词不存在" });
  }

  return res.status(204).send();
};
