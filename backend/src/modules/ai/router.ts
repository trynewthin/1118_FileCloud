import express from "express";
import fs from "fs";
import path from "path";
import Busboy from "busboy";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import {
  listAiProviders,
  createAiProvider,
  updateAiProvider,
  deleteAiProvider,
  listAiChatModels,
  createAiChatModel,
  updateAiChatModel,
  deleteAiChatModel,
  listAiChatPrompts,
  createAiChatPrompt,
  updateAiChatPrompt,
  deleteAiChatPrompt,
  listAiChatConversationsByUser,
  getAiChatConversationById,
  getAiChatModelById,
  createAiChatConversation,
  updateAiChatConversation,
  deleteAiChatConversation,
  listAiChatMessagesByConversation,
  appendUserMessageAndReply,
  listAiToolConfigs,
  upsertAiToolConfig,
  createAiChatUpload,
  getAiChatUploadById,
} from "./service.ts";
import { getSetting } from "../settings/service.ts";

// AI 上传文件存储目录
const AI_UPLOADS_DIR = path.join(process.cwd(), "data", "ai_uploads");

// 确保上传目录存在
if (!fs.existsSync(AI_UPLOADS_DIR)) {
  fs.mkdirSync(AI_UPLOADS_DIR, { recursive: true });
}

const router = express.Router();

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

// 供应商管理（仅管理员）
router.get(
  "/providers",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (_req, res) => {
    const items = listAiProviders();
    return res.json({ items });
  },
);

router.post(
  "/providers",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
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
  },
);

router.put(
  "/providers/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "供应商 ID 不合法" });
    }

    const provider = updateAiProvider(id, req.body ?? {});
    if (!provider) {
      return res.status(404).json({ message: "供应商不存在" });
    }

    return res.json({ provider });
  },
);

router.delete(
  "/providers/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "供应商 ID 不合法" });
    }

    const ok = deleteAiProvider(id);
    if (!ok) {
      return res.status(404).json({ message: "供应商不存在" });
    }

    return res.status(204).send();
  },
);

// 模型管理（仅管理员）
router.get(
  "/models",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (_req, res) => {
    const items = listAiChatModels();
    return res.json({ items });
  },
);

router.post(
  "/models",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { key, displayName, providerId, modelName, apiMode, capabilities, defaultMaxContextMessages, allowOverrideContextLimit, isEnabled } =
      req.body as any;

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
  },
);

router.put(
  "/models/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "模型 ID 不合法" });
    }

    const model = updateAiChatModel(id, req.body ?? {});
    if (!model) {
      return res.status(404).json({ message: "模型不存在" });
    }

    return res.json({ model });
  },
);

router.delete(
  "/models/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "模型 ID 不合法" });
    }

    const ok = deleteAiChatModel(id);
    if (!ok) {
      return res.status(404).json({ message: "模型不存在" });
    }

    return res.status(204).send();
  },
);

// 提示词管理（仅管理员）
router.get(
  "/prompts",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (_req, res) => {
    const items = listAiChatPrompts();
    return res.json({ items });
  },
);

router.post(
  "/prompts",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
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
  },
);

router.put(
  "/prompts/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "提示词 ID 不合法" });
    }

    const prompt = updateAiChatPrompt(id, req.body ?? {});
    if (!prompt) {
      return res.status(404).json({ message: "提示词不存在" });
    }

    return res.json({ prompt });
  },
);

router.delete(
  "/prompts/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "提示词 ID 不合法" });
    }

    const ok = deleteAiChatPrompt(id);
    if (!ok) {
      return res.status(404).json({ message: "提示词不存在" });
    }

    return res.status(204).send();
  },
);

// 工具配置（仅管理员）
router.get(
  "/tools",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (_req, res) => {
    const items = listAiToolConfigs();
    return res.json({ items });
  },
);

router.put(
  "/tools/:toolKey",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const rawKey = (req.params.toolKey ?? "").trim();
    if (!rawKey) {
      return res.status(400).json({ message: "工具标识不能为空" });
    }

    const body = (req.body ?? {}) as any;
    const config = upsertAiToolConfig(rawKey, body);

    return res.json({ config });
  },
);

// 会话与消息（普通用户）
router.get(
  "/conversations",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "未登录" });
    }

    const items = listAiChatConversationsByUser(req.user.id, { includeArchived: false });
    return res.json({ items });
  },
);

router.post(
  "/conversations",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
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
  },
);

router.patch(
  "/conversations/:id",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
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

    const updated = updateAiChatConversation(id, body);
    if (!updated) {
      return res.status(500).json({ message: "更新会话失败" });
    }

    return res.json({ conversation: updated });
  },
);

router.delete(
  "/conversations/:id",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
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
  },
);

router.get(
  "/conversations/:id/messages",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
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
  },
);

// 上传图片附件
router.post(
  "/uploads",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "未登录" });
    }

    const userId = req.user.id;
    const uploads: { id: number; originalName: string }[] = [];

    try {
      const busboy = Busboy({ headers: req.headers });

      busboy.on("file", (fieldname, file, info) => {
        const { filename, mimeType } = info;
        
        // 只允许图片
        if (!mimeType.startsWith("image/")) {
          file.resume(); // 跳过非图片文件
          return;
        }

        const ext = path.extname(filename).toLowerCase() || ".png";
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        const relPath = uniqueName;
        const fullPath = path.join(AI_UPLOADS_DIR, uniqueName);

        const chunks: Buffer[] = [];
        file.on("data", (chunk) => chunks.push(chunk));
        file.on("end", () => {
          const buffer = Buffer.concat(chunks);
          fs.writeFileSync(fullPath, buffer);

          const upload = createAiChatUpload({
            userId,
            originalName: filename,
            extension: ext,
            mimeType,
            sizeBytes: buffer.length,
            storageRelPath: relPath,
          });

          uploads.push({ id: upload.id, originalName: filename });
        });
      });

      busboy.on("finish", () => {
        res.json({ uploads });
      });

      busboy.on("error", (err) => {
        console.error("上传处理错误:", err);
        res.status(500).json({ message: "上传处理失败" });
      });

      req.pipe(busboy);
    } catch (err: any) {
      console.error("上传错误:", err);
      res.status(500).json({ message: "上传失败" });
    }
  },
);

// 获取上传的图片（支持 token 查询参数认证，用于 img src）
router.get(
  "/uploads/:id",
  async (req, res, next) => {
    // 如果 URL 中有 token 参数，将其设置到 Authorization header
    const tokenFromQuery = req.query.token as string | undefined;
    if (tokenFromQuery && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${tokenFromQuery}`;
    }
    next();
  },
  authenticate,
  requirePermission(PermissionLevel.User),
  async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "未登录" });
    }

    const uploadId = parseInt(req.params.id ?? "", 10);
    if (isNaN(uploadId) || uploadId <= 0) {
      return res.status(400).json({ message: "无效的上传 ID" });
    }

    try {
      const upload = getAiChatUploadById(uploadId);
      if (!upload) {
        return res.status(404).json({ message: "上传记录不存在" });
      }

      // 验证用户权限
      if (upload.user_id !== req.user.id) {
        return res.status(403).json({ message: "无权访问该文件" });
      }

      const absPath = path.join(AI_UPLOADS_DIR, upload.storage_rel_path);
      if (!fs.existsSync(absPath)) {
        return res.status(404).json({ message: "文件不存在" });
      }

      res.setHeader("Content-Type", upload.mime_type || "application/octet-stream");
      res.setHeader("Cache-Control", "public, max-age=31536000");
      fs.createReadStream(absPath).pipe(res);
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "获取文件失败";
      return res.status(500).json({ message });
    }
  },
);

router.post(
  "/conversations/:id/messages",
  authenticate,
  requirePermission(PermissionLevel.User),
  async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "未登录" });
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "会话 ID 不合法" });
    }

    const { content, attachmentIds } = req.body as { 
      content?: string;
      attachmentIds?: number[];
    };
    
    // 如果有附件，内容可以为空
    const hasAttachments = attachmentIds && Array.isArray(attachmentIds) && attachmentIds.length > 0;
    if ((!content || !content.trim()) && !hasAttachments) {
      return res.status(400).json({ message: "消息内容不能为空" });
    }

    // 验证 attachmentIds 格式
    let validAttachmentIds: number[] | undefined;
    if (hasAttachments) {
      validAttachmentIds = attachmentIds.filter(
        (id) => Number.isInteger(id) && id > 0
      );
    }

    try {
      const result = await appendUserMessageAndReply({
        conversationId: id,
        userId: req.user.id,
        content: content?.trim() || "",
        attachmentIds: validAttachmentIds,
      });

      return res.status(201).json({
        userMessage: result.userMessage,
        assistantMessage: result.assistantMessage,
      });
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "调用 AI 对话失败";
      return res.status(400).json({ message });
    }
  },
);

// 执行待确认的工具操作
router.post(
  "/tools/execute",
  authenticate,
  requirePermission(PermissionLevel.User),
  async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "未登录" });
    }

    const { toolName, args, conversationId } = req.body as {
      toolName: string;
      args: Record<string, any>;
      conversationId: number;
    };

    if (!toolName || !args) {
      return res.status(400).json({ message: "缺少必要参数" });
    }

    try {
      // 导入任务服务
      const { createTask } = await import("../tasks/service.ts");
      const {
        TASK_TYPE_FILE_DELETE_ENTRY,
        TASK_TYPE_FILE_RENAME_ENTRY,
        TASK_TYPE_FILE_MOVE_ENTRY,
      } = await import("../files/fileOpsTasks.ts");

      let result: { success: boolean; message: string };

      switch (toolName) {
        case "rename_file": {
          const fileId = args.file_id;
          const newName = args.new_name;
          if (!fileId || !newName) {
            return res.status(400).json({ message: "缺少文件 ID 或新名称" });
          }
          createTask({
            type: TASK_TYPE_FILE_RENAME_ENTRY,
            payload: { entryId: fileId, newName },
            createdByUserId: req.user.id,
          });
          result = { success: true, message: `文件重命名任务已创建` };
          break;
        }

        case "move_file": {
          const fileId = args.file_id;
          const targetParentId = args.target_parent_id;
          if (!fileId) {
            return res.status(400).json({ message: "缺少文件 ID" });
          }
          createTask({
            type: TASK_TYPE_FILE_MOVE_ENTRY,
            payload: { entryId: fileId, targetParentId: targetParentId || null },
            createdByUserId: req.user.id,
          });
          result = { success: true, message: `文件移动任务已创建` };
          break;
        }

        case "delete_file": {
          const fileId = args.file_id;
          if (!fileId) {
            return res.status(400).json({ message: "缺少文件 ID" });
          }
          createTask({
            type: TASK_TYPE_FILE_DELETE_ENTRY,
            payload: { entryId: fileId },
            createdByUserId: req.user.id,
          });
          result = { success: true, message: `文件删除任务已创建` };
          break;
        }

        default:
          return res.status(400).json({ message: `不支持的工具: ${toolName}` });
      }

      return res.json(result);
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "执行工具失败";
      return res.status(400).json({ message });
    }
  },
);

export { router as aiRouter };
