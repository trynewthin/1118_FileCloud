import express from "express";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";

// 控制器导入
import {
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
} from "./controllers/providerController.ts";
import {
  listModels,
  createModel,
  updateModel,
  deleteModel,
} from "./controllers/modelController.ts";
import {
  listPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
} from "./controllers/promptController.ts";
import {
  listToolkits,
  listTools,
  updateToolConfig,
  executeTool,
} from "./controllers/toolController.ts";
import {
  listConversations,
  createConversation,
  updateConversation,
  deleteConversation,
  listMessages,
} from "./controllers/conversationController.ts";
import { sendMessage, abortMessage } from "./controllers/messageController.ts";
import { smartRename } from "./smartRename/controller.ts";

// 子路由导入
import conversationFilesRouter from "./conversationFiles/router.ts";

const router = express.Router();

// ============================================================================
// 工具包 API
// ============================================================================

router.get(
  "/toolkits",
  authenticate,
  requirePermission(PermissionLevel.User),
  listToolkits,
);

// ============================================================================
// 供应商管理（仅管理员）
// ============================================================================

router.get(
  "/providers",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  listProviders,
);

router.post(
  "/providers",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  createProvider,
);

router.put(
  "/providers/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  updateProvider,
);

router.delete(
  "/providers/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  deleteProvider,
);

// ============================================================================
// 模型管理（仅管理员）
// ============================================================================

router.get(
  "/models",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  listModels,
);

router.post(
  "/models",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  createModel,
);

router.put(
  "/models/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  updateModel,
);

router.delete(
  "/models/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  deleteModel,
);

// ============================================================================
// 提示词管理（仅管理员）
// ============================================================================

router.get(
  "/prompts",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  listPrompts,
);

router.post(
  "/prompts",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  createPrompt,
);

router.put(
  "/prompts/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  updatePrompt,
);

router.delete(
  "/prompts/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  deletePrompt,
);

// ============================================================================
// 工具配置（仅管理员）
// ============================================================================

router.get(
  "/tools",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  listTools,
);

router.put(
  "/tools/:toolKey",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  updateToolConfig,
);

// ============================================================================
// 会话与消息（普通用户）
// ============================================================================

router.get(
  "/conversations",
  authenticate,
  requirePermission(PermissionLevel.User),
  listConversations,
);

router.post(
  "/conversations",
  authenticate,
  requirePermission(PermissionLevel.User),
  createConversation,
);

router.patch(
  "/conversations/:id",
  authenticate,
  requirePermission(PermissionLevel.User),
  updateConversation,
);

router.delete(
  "/conversations/:id",
  authenticate,
  requirePermission(PermissionLevel.User),
  deleteConversation,
);

router.get(
  "/conversations/:id/messages",
  authenticate,
  requirePermission(PermissionLevel.User),
  listMessages,
);

// 发送消息（流式接口）
router.post(
  "/conversations/:id/messages",
  authenticate,
  requirePermission(PermissionLevel.User),
  sendMessage,
);

// 主动终止正在进行的流式消息
router.post(
  "/conversations/:id/messages/abort",
  authenticate,
  requirePermission(PermissionLevel.User),
  abortMessage,
);

// ============================================================================
// 工具执行（普通用户）
// ============================================================================

router.post(
  "/tools/execute",
  authenticate,
  requirePermission(PermissionLevel.User),
  executeTool,
);

// ============================================================================
// 智能重命名
// ============================================================================

router.post(
  "/smart-rename",
  authenticate,
  requirePermission(PermissionLevel.User),
  smartRename,
);

// ============================================================================
// 挂载子路由
// ============================================================================

router.use("/files", conversationFilesRouter);

export { router as aiRouter };
