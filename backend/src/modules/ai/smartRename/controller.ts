import type { Request, Response } from "express";
import { performSmartRename, parseErrorMessage } from "./service.ts";
import { createLogger } from "../../../core/logger/index.ts";
import type { SmartRenameRequest } from "./types.ts";

const logger = createLogger("AI/SmartRename");

/**
 * 智能重命名控制器
 */

export const smartRename = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  const { fileName, fileExtension, modelId, entryId } = req.body as SmartRenameRequest;

  if (!fileName) {
    logger.warn("智能重命名请求被拒绝：文件名为空");
    return res.status(400).json({ message: "文件名不能为空" });
  }

  try {
    const result = await performSmartRename(
      { fileName, fileExtension, modelId, entryId },
      req.user.id,
    );

    return res.json(result);
  } catch (err: any) {
    logger.error("智能重命名失败:", err);
    const message = parseErrorMessage(err);
    return res.status(400).json({ message });
  }
};
