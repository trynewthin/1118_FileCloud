import type { Request, Response } from "express";
import {
  listAiChatConversationsByUser,
  getAiChatConversationById,
  getAiChatModelById,
  createAiChatConversation,
  updateAiChatConversation,
  deleteAiChatConversation,
  listAiChatMessagesByConversation,
} from "../service.ts";
import { getSetting } from "../../settings/service.ts";

/**
 * 会话管理控制器
 */

// 获取默认聊天模型ID
const DEFAULT_MODEL_SETTING_KEY = "ai.chat.defaultModelId";

const getDefaultChatModelId = (): number | null => {
  const raw = getSetting(DEFAULT_MODEL_SETTING_KEY);
  if (!raw) return null;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  const model = getAiChatModelById(parsed);
  if (!model || !model.is_enabled) {
    return null;
  }

  return model.id;
};

// 获取会话列表
export const listConversations = (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  const items = listAiChatConversationsByUser(req.user.id, { includeArchived: false });
  return res.json({ items });
};

// 创建会话
export const createConversation = (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  const { modelId, title, systemPrompt, maxContextMessages, memoryEnabled, memoryStrategy, metadata } =
    req.body as any;

  let finalModelId: number | null = null;
  if (modelId !== undefined && modelId !== null) {
    const parsed = Number(modelId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return res.status(400).json({ message: "模型 ID 不合法" });
    }

    const model = getAiChatModelById(parsed);
    if (!model || !model.is_enabled) {
      return res.status(400).json({ message: "指定的模型不存在或未启用" });
    }

    finalModelId = model.id;
  } else {
    const defaultModelId = getDefaultChatModelId();
    if (!defaultModelId) {
      return res
        .status(400)
        .json({ message: "未配置默认模型或默认模型不可用，请联系管理员在系统设置中配置" });
    }
    finalModelId = defaultModelId;
  }

  const conv = createAiChatConversation({
    userId: req.user.id,
    modelId: finalModelId,
    title: title ?? null,
    metadata: metadata ?? null,
    systemPrompt: systemPrompt ?? null,
    maxContextMessages: maxContextMessages ?? null,
    memoryEnabled: memoryEnabled ?? true,
    memoryStrategy: memoryStrategy ?? null,
  });

  return res.status(201).json({ conversation: conv });
};

// 更新会话
export const updateConversation = (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "会话 ID 不合法" });
  }

  const conv = getAiChatConversationById(id);
  if (!conv) {
    return res.status(404).json({ message: "会话不存在" });
  }

  if (conv.user_id !== req.user.id) {
    return res.status(403).json({ message: "无权操作该会话" });
  }

  const body = (req.body ?? {}) as any;

  if (body.modelId !== undefined && body.modelId !== null) {
    const parsedModelId = Number(body.modelId);
    if (!Number.isInteger(parsedModelId) || parsedModelId <= 0) {
      return res.status(400).json({ message: "模型 ID 不合法" });
    }

    const model = getAiChatModelById(parsedModelId);
    if (!model || !model.is_enabled) {
      return res.status(400).json({ message: "指定的模型不存在或未启用" });
    }

    body.modelId = parsedModelId;
  }

  // 处理 toolkitsConfig 更新（增量合并到 metadata）
  if (body.toolkitsConfig !== undefined) {
    const existingMetadata = conv.metadata ?? {};
    body.metadata = {
      ...existingMetadata,
      toolkitsConfig: body.toolkitsConfig,
    };
    delete body.toolkitsConfig;
  }

  const updated = updateAiChatConversation(id, body);
  if (!updated) {
    return res.status(500).json({ message: "更新会话失败" });
  }

  return res.json({ conversation: updated });
};

// 删除会话
export const deleteConversation = (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "会话 ID 不合法" });
  }

  const conv = getAiChatConversationById(id);
  if (!conv) {
    return res.status(404).json({ message: "会话不存在" });
  }

  if (conv.user_id !== req.user.id) {
    return res.status(403).json({ message: "无权操作该会话" });
  }

  const ok = deleteAiChatConversation(id);
  if (!ok) {
    return res.status(500).json({ message: "删除会话失败" });
  }

  return res.status(204).send();
};

// 获取会话消息列表
export const listMessages = (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "会话 ID 不合法" });
  }

  const conv = getAiChatConversationById(id);
  if (!conv) {
    return res.status(404).json({ message: "会话不存在" });
  }

  if (conv.user_id !== req.user.id) {
    return res.status(403).json({ message: "无权操作该会话" });
  }

  const messages = listAiChatMessagesByConversation(id, { limit: 200, offset: 0 });
  return res.json({ items: messages });
};
