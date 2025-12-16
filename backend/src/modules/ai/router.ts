import express from "express";
import fs from "fs";
import path from "path";
import Busboy from "busboy";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import { createLogger } from "../../core/logger/index.ts";
import { getAiUploadsStorageDir } from "../../core/config/paths.ts";
import {
  listAiProviders,
  createAiProvider,
  updateAiProvider,
  deleteAiProvider,
  getAiProviderById,
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
import { getToolKitList } from "./toolkits/index.ts";

// AI 上传文件存储目录
const AI_UPLOADS_DIR = getAiUploadsStorageDir();

// 确保上传目录存在
if (!fs.existsSync(AI_UPLOADS_DIR)) {
  fs.mkdirSync(AI_UPLOADS_DIR, { recursive: true });
}

const router = express.Router();
const logger = createLogger("AI/SmartRename");

// ============================================================================
// 工具包 API
// ============================================================================

// 获取工具包列表
router.get(
  "/toolkits",
  authenticate,
  requirePermission(PermissionLevel.User),
  (_req, res) => {
    const items = getToolKitList();
    return res.json({ items });
  },
);

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

// 智能重命名
router.post(
  "/smart-rename",
  authenticate,
  requirePermission(PermissionLevel.User),
  async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "未登录" });
    }

    const { fileName, fileExtension, modelId, entryId } = req.body as {
      fileName?: string;
      fileExtension?: string;
      modelId?: number;
      entryId?: string;
    };

    logger.info(`收到智能重命名请求 - 用户: ${req.user.id}, 文件名: ${fileName}, 扩展名: ${fileExtension || "无"}, entryId: ${entryId || "未提供"}`);

    if (!fileName) {
      logger.warn("智能重命名请求被拒绝：文件名为空");
      return res.status(400).json({ message: "文件名不能为空" });
    }

    try {
      // 获取智能重命名模型配置
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
        // 从设置中获取智能重命名默认模型
        const renameModelSetting = getSetting("ai.rename.defaultModelId");
        if (renameModelSetting) {
          const parsed = Number(renameModelSetting);
          if (Number.isInteger(parsed) && parsed > 0) {
            const model = getAiChatModelById(parsed);
            if (model && model.is_enabled) {
              finalModelId = model.id;
            }
          }
        }
      }

      if (!finalModelId) {
        logger.warn("未配置智能重命名模型");
        return res.status(400).json({ 
          message: "未配置智能重命名模型，请在 AI 设置中配置" 
        });
      }

      logger.info(`使用模型 ID: ${finalModelId}`);

      // 获取文件上下文信息
      let contextInfo = "";
      if (entryId) {
        logger.debug(`开始获取文件上下文信息 - entryId: ${entryId}`);
        try {
          const { getEntryById, listEntriesByParent } = await import("../files/service.ts");
          const entry = getEntryById(entryId);
          
          if (entry) {
            // 获取父目录信息
            if (entry.parent_id) {
              const parentEntry = getEntryById(entry.parent_id);
              if (parentEntry) {
                contextInfo += `\n父目录名称：${parentEntry.original_name}`;
                logger.debug(`父目录: ${parentEntry.original_name}`);
              }
            } else {
              contextInfo += `\n位置：文件库根目录`;
              logger.debug("位置: 文件库根目录");
            }

            // 获取同级文件列表（最多10个）
            const siblings = listEntriesByParent({
              libraryId: entry.library_id,
              parentId: entry.parent_id,
            }).filter(e => e.id !== entryId).slice(0, 10);

            if (siblings.length > 0) {
              contextInfo += `\n同级文件/文件夹：${siblings.map(s => s.original_name).join(", ")}`;
              logger.debug(`同级文件数量: ${siblings.length}, 示例: ${siblings.slice(0, 3).map(s => s.original_name).join(", ")}`);
            }
          } else {
            logger.warn(`未找到 entryId 对应的文件: ${entryId}`);
          }
        } catch (err) {
          // 忽略上下文获取错误，继续使用基础重命名
          logger.error("获取文件上下文信息失败:", err);
        }
      } else {
        logger.debug("未提供 entryId，跳过上下文信息获取");
      }

      // 获取重命名风格配置
      const renamingStyle = getSetting("ai.rename.style") || "auto";
      logger.debug(`重命名风格: ${renamingStyle}`);

      // 构建提示词
      const customPrompt = getSetting("ai.rename.prompt");
      
      // 根据风格构建不同的提示词
      let styleGuidance = "";
      switch (renamingStyle) {
        case "structured":
          styleGuidance = "\n风格要求：使用结构化命名，保留所有重要信息（如剧集编号、日期、序号等），格式为：主题_详细信息_编号";
          break;
        case "simplified":
          styleGuidance = "\n风格要求：使用精简化命名，只保留最核心的信息，去除冗余内容";
          break;
        case "auto":
        default:
          styleGuidance = "\n风格要求：根据文件类型和上下文自动选择最合适的命名方式";
          break;
      }

      const systemPrompt = customPrompt || 
        "你是一个文件命名助手。根据用户提供的文件名及其上下文信息（父目录名称、同级文件名称），生成一个更规范、更有意义的文件名。\n" +
        "要求：\n" +
        "1. **最重要**：只返回新文件名，不要包含任何解释、思考过程或额外文字，直接输出文件名\n" +
        "2. 不要改变文件扩展名\n" +
        "3. 使用简洁、描述性的命名\n" +
        "4. 避免特殊字符，使用下划线或连字符分隔\n" +
        "5. 综合考虑父目录名称和同级文件的命名规律\n" +
        "6. **重要**：如果文件名包含剧集编号（如 S01E01、E01、第01集等）、日期（如 2024-01-01）、序号等结构化信息，必须保留这些信息\n" +
        "7. **重要**：对于剧集文件，应该是：父目录名称 + 剧集编号，例如 '疯狂动物城衍生剧_S01E03'\n" +
        "8. 如果原文件名已经很好，或者无法根据上下文判断出更好的名称，请直接返回英文单词：UNKNOWN\n" +
        "9. **禁止**：不要输出任何推理过程、解释说明或markdown格式，只输出最终的文件名" +
        styleGuidance;

      const userMessage = fileExtension 
        ? `请为这个文件生成一个更好的文件名（不含扩展名）：${fileName}${contextInfo}`
        : `请为这个文件生成一个更好的文件名：${fileName}${contextInfo}`;

      // 调用 AI 模型
      logger.info("开始调用 AI 模型");
      logger.debug(`提示词长度: ${systemPrompt.length} 字符, 用户消息长度: ${userMessage.length} 字符`);
      
      const { callChatModel } = await import("../../core/ai/client.ts");
      const model = getAiChatModelById(finalModelId)!;
      const provider = model.provider_id ? getAiProviderById(model.provider_id) : null;

      logger.debug(`模型: ${model.display_name} (${model.model_name}), 供应商: ${provider?.name || "无"}`);
      
      // 检测推理模型并给出警告
      const isReasoningModel = model.model_name.includes("preview") || 
                               model.model_name.includes("reasoning") ||
                               model.model_name.includes("o1") ||
                               model.model_name.includes("o3");
      if (isReasoningModel) {
        logger.warn(`检测到推理模型 (${model.model_name})，可能不适合简单的文件重命名任务，建议使用普通模型`);
      }

      // 构建模型配置
      const config = {
        baseUrl: provider?.base_url || "",
        apiKey: provider?.api_key || null,
        apiType: provider?.api_type || "openai_compatible",
        model: model.model_name,
        timeoutMs: provider?.timeout_ms || null,
      };

      const messages = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userMessage }
      ];

      const startTime = Date.now();
      const result = await callChatModel(config, messages, {
        temperature: 0.7,
        maxTokens: 500, // 增加 token 限制，给推理模型足够空间
      });
      const duration = Date.now() - startTime;

      logger.info(`AI 模型响应成功 - 耗时: ${duration}ms`);
      logger.debug(`AI 原始响应:`, JSON.stringify(result.raw, null, 2));

      let suggestedName = result.content.trim();
      
      // 检查是否被截断（finish_reason 为 length）
      const finishReason = result.finish_reason;
      if (finishReason === "length") {
        logger.warn(`AI 响应被截断 (finish_reason: ${finishReason})，可能无法获得完整答案`);
      }
      
      // 如果返回的是推理内容，尝试提取最终答案
      if (suggestedName && (
        suggestedName.includes("**") || 
        suggestedName.includes("Processing") || 
        suggestedName.includes("analyzing") ||
        suggestedName.includes("I've been") ||
        suggestedName.includes("I'm") ||
        suggestedName.length > 200
      )) {
        logger.debug("检测到推理内容，尝试提取最终答案");
        
        // 如果被截断，直接返回 UNKNOWN，因为无法获得完整答案
        if (finishReason === "length") {
          logger.warn("推理内容被截断，无法提取有效答案，返回 UNKNOWN");
          suggestedName = "UNKNOWN";
        } else {
          // 尝试提取最后一行非空内容作为答案
          const lines = suggestedName.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('**') && !l.startsWith('#'));
          if (lines.length > 0) {
            const extracted = lines[lines.length - 1];
            if (extracted) {
              suggestedName = extracted;
              logger.debug(`从推理内容中提取: "${suggestedName}"`);
            }
          }
        }
      }
      
      logger.debug(`AI 返回内容: "${suggestedName}"`);

      // 检查是否为空响应
      if (!suggestedName) {
        logger.warn("AI 模型返回了空响应");
        return res.status(400).json({ 
          message: "AI 模型返回了空响应，请稍后重试或更换模型" 
        });
      }

      // 检查是否返回 UNKNOWN
      if (suggestedName.toUpperCase() === "UNKNOWN") {
        logger.info("AI 返回 UNKNOWN，表示无法判断更好的名称");
      } else {
        logger.info(`智能重命名成功 - 原名称: "${fileName}", 建议名称: "${suggestedName}"`);
      }

      return res.json({ 
        suggestedName,
        originalName: fileName,
        extension: fileExtension || null,
      });
    } catch (err: any) {
      // 处理 429 和其他 API 错误
      logger.error("智能重命名失败:", err);
      
      let message = "智能重命名失败";
      
      if (err?.message) {
        const errMsg = err.message;
        if (errMsg.includes("429") || errMsg.includes("Too Many Requests")) {
          message = "AI 服务请求过于频繁，请稍后再试";
          logger.warn("遇到 429 错误 - 请求过于频繁");
        } else if (errMsg.includes("empty_response") || errMsg.includes("empty response")) {
          message = "AI 模型返回了空响应，请稍后重试或更换模型";
          logger.warn("AI 返回空响应");
        } else if (errMsg.includes("timeout")) {
          message = "AI 服务响应超时，请重试";
          logger.warn("AI 服务超时");
        } else {
          message = errMsg;
          logger.error(`未分类的错误: ${errMsg}`);
        }
      }
      
      return res.status(400).json({ message });
    }
  },
);

export { router as aiRouter };
