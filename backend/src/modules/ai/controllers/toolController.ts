import type { Request, Response } from "express";
import { assertEntryAccess, assertFileMutationAccess, AccessError } from "../../../core/auth/libraryAccess.ts";
import { checkEntryPasswordIfProtected } from "../../files/index.ts";
import { listAiToolConfigs, upsertAiToolConfig } from "../service.ts";
import { getToolKitList } from "../toolkits/index.ts";
import { createLogger } from "../../../core/logger/index.ts";

const logger = createLogger("AI/ToolController");

/**
 * 工具管理控制器
 */

// 获取工具包列表
export const listToolkits = (_req: Request, res: Response) => {
  const items = getToolKitList();
  return res.json({ items });
};

// 获取工具配置列表
export const listTools = (_req: Request, res: Response) => {
  const items = listAiToolConfigs();
  return res.json({ items });
};

// 更新工具配置
export const updateToolConfig = (req: Request, res: Response) => {
  const rawKey = (req.params.toolKey ?? "").trim();
  if (!rawKey) {
    return res.status(400).json({ message: "工具标识不能为空" });
  }

  const body = (req.body ?? {}) as any;
  const config = upsertAiToolConfig(rawKey, body);

  return res.json({ config });
};

// 执行待确认的工具操作
export const executeTool = async (req: Request, res: Response) => {
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
    // Match the REST file mutation policy even when called directly, without
    // a model-generated pending action or conversation ID.
    assertFileMutationAccess(req.user);
    if (!["rename_file", "move_file", "delete_file"].includes(toolName)) {
      return res.status(400).json({ message: "不支持的工具" });
    }
    const { entry } = await assertEntryAccess(req.user, args.file_id);
    const passwordCheck = checkEntryPasswordIfProtected(entry.id, args.password);
    if (!passwordCheck.ok) throw new AccessError(passwordCheck.message ?? "需要提供访问密码", 403);
    if (toolName === "move_file" && args.target_parent_id != null) {
      const { entry: target } = await assertEntryAccess(req.user, args.target_parent_id, { libraryId: entry.library_id, directory: true });
      const targetCheck = checkEntryPasswordIfProtected(target.id, args.password);
      if (!targetCheck.ok) throw new AccessError(targetCheck.message ?? "需要提供访问密码", 403);
    }
    // 导入任务服务
    const { createTask } = await import("../../tasks/index.ts");
    const {
      TASK_TYPE_FILE_DELETE_ENTRY,
      TASK_TYPE_FILE_RENAME_ENTRY,
      TASK_TYPE_FILE_MOVE_ENTRY,
    } = await import("../../files/index.ts");

    let result: { success: boolean; message: string };

    switch (toolName) {
      case "rename_file": {
        const fileId = args.file_id;
        const newName = args.new_name;
        if (!fileId || typeof newName !== "string" || !newName.trim() || /[\\/:*?"<>|\x00-\x1f]/.test(newName) || [".", ".."].includes(newName.trim())) {
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
    logger.error(`工具执行失败: ${toolName}`, err);
    return res.status(err.status ?? 400).json({ message });
  }
};
