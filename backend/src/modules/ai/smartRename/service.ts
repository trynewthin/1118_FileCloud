import { createLogger } from "../../../core/logger/index.ts";
import { callChatModel } from "../../../core/ai/client.ts";
import { getSetting } from "../../settings/service.ts";
import { getAiChatModelById, getAiProviderById } from "../service.ts";
import type { SmartRenameRequest, SmartRenameResult, FileContextInfo } from "./types.ts";

const logger = createLogger("AI/SmartRename");

/**
 * 智能重命名服务
 */

// 获取文件上下文信息
export const getFileContext = async (entryId: string): Promise<FileContextInfo> => {
  const result: FileContextInfo = {};

  try {
    const { getEntryById, listEntriesByParent } = await import("../../files/service.ts");
    const entry = getEntryById(entryId);

    if (!entry) {
      logger.warn(`未找到 entryId 对应的文件: ${entryId}`);
      return result;
    }

    // 获取父目录信息
    if (entry.parent_id) {
      const parentEntry = getEntryById(entry.parent_id);
      if (parentEntry) {
        result.parentName = parentEntry.original_name;
        logger.debug(`父目录: ${parentEntry.original_name}`);
      }
    } else {
      result.isRoot = true;
      logger.debug("位置: 文件库根目录");
    }

    // 获取同级文件列表（最多10个）
    const siblings = listEntriesByParent({
      libraryId: entry.library_id,
      parentId: entry.parent_id,
    })
      .filter((e) => e.id !== entryId)
      .slice(0, 10);

    if (siblings.length > 0) {
      result.siblingNames = siblings.map((s) => s.original_name);
      logger.debug(
        `同级文件数量: ${siblings.length}, 示例: ${siblings
          .slice(0, 3)
          .map((s) => s.original_name)
          .join(", ")}`,
      );
    }
  } catch (err) {
    logger.error("获取文件上下文信息失败:", err);
  }

  return result;
};

// 构建上下文信息字符串
const buildContextString = (context: FileContextInfo): string => {
  let contextInfo = "";

  if (context.isRoot) {
    contextInfo += "\n位置：文件库根目录";
  } else if (context.parentName) {
    contextInfo += `\n父目录名称：${context.parentName}`;
  }

  if (context.siblingNames && context.siblingNames.length > 0) {
    contextInfo += `\n同级文件/文件夹：${context.siblingNames.join(", ")}`;
  }

  return contextInfo;
};

// 构建系统提示词
const buildSystemPrompt = (renamingStyle: string, customPrompt?: string): string => {
  if (customPrompt) {
    return customPrompt;
  }

  // 根据风格构建不同的提示词
  let styleGuidance = "";
  switch (renamingStyle) {
    case "structured":
      styleGuidance =
        "\n风格要求：使用结构化命名，保留所有重要信息（如剧集编号、日期、序号等），格式为：主题_详细信息_编号";
      break;
    case "simplified":
      styleGuidance = "\n风格要求：使用精简化命名，只保留最核心的信息，去除冗余内容";
      break;
    case "auto":
    default:
      styleGuidance = "\n风格要求：根据文件类型和上下文自动选择最合适的命名方式";
      break;
  }

  return (
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
    styleGuidance
  );
};

// 解析AI响应，提取最终文件名
const parseAiResponse = (content: string, finishReason?: string): string => {
  let suggestedName = content.trim();

  // 如果返回的是推理内容，尝试提取最终答案
  if (
    suggestedName &&
    (suggestedName.includes("**") ||
      suggestedName.includes("Processing") ||
      suggestedName.includes("analyzing") ||
      suggestedName.includes("I've been") ||
      suggestedName.includes("I'm") ||
      suggestedName.length > 200)
  ) {
    logger.debug("检测到推理内容，尝试提取最终答案");

    // 如果被截断，直接返回 UNKNOWN，因为无法获得完整答案
    if (finishReason === "length") {
      logger.warn("推理内容被截断，无法提取有效答案，返回 UNKNOWN");
      return "UNKNOWN";
    }

    // 尝试提取最后一行非空内容作为答案
    const lines = suggestedName
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("**") && !l.startsWith("#"));
    if (lines.length > 0) {
      const extracted = lines[lines.length - 1];
      if (extracted) {
        suggestedName = extracted;
        logger.debug(`从推理内容中提取: "${suggestedName}"`);
      }
    }
  }

  return suggestedName;
};

// 解析错误消息
export const parseErrorMessage = (err: any): string => {
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

  return message;
};

// 执行智能重命名
export const performSmartRename = async (
  request: SmartRenameRequest,
  userId: number,
): Promise<SmartRenameResult> => {
  const { fileName, fileExtension, modelId, entryId } = request;

  logger.info(
    `收到智能重命名请求 - 用户: ${userId}, 文件名: ${fileName}, 扩展名: ${fileExtension || "无"}, entryId: ${entryId || "未提供"}`,
  );

  // 获取智能重命名模型配置
  let finalModelId: number | null = null;
  if (modelId !== undefined && modelId !== null) {
    const parsed = Number(modelId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error("模型 ID 不合法");
    }

    const model = getAiChatModelById(parsed);
    if (!model || !model.is_enabled) {
      throw new Error("指定的模型不存在或未启用");
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
    throw new Error("未配置智能重命名模型，请在 AI 设置中配置");
  }

  logger.info(`使用模型 ID: ${finalModelId}`);

  // 获取文件上下文信息
  let contextInfo = "";
  if (entryId) {
    logger.debug(`开始获取文件上下文信息 - entryId: ${entryId}`);
    const context = await getFileContext(entryId);
    contextInfo = buildContextString(context);
  } else {
    logger.debug("未提供 entryId，跳过上下文信息获取");
  }

  // 获取重命名风格配置
  const renamingStyle = getSetting("ai.rename.style") || "auto";
  logger.debug(`重命名风格: ${renamingStyle}`);

  // 构建提示词
  const customPrompt = getSetting("ai.rename.prompt");
  const systemPrompt = buildSystemPrompt(renamingStyle, customPrompt || undefined);

  const userMessage = fileExtension
    ? `请为这个文件生成一个更好的文件名（不含扩展名）：${fileName}${contextInfo}`
    : `请为这个文件生成一个更好的文件名：${fileName}${contextInfo}`;

  // 调用 AI 模型
  logger.info("开始调用 AI 模型");
  logger.debug(`提示词长度: ${systemPrompt.length} 字符, 用户消息长度: ${userMessage.length} 字符`);

  const model = getAiChatModelById(finalModelId)!;
  const provider = model.provider_id ? getAiProviderById(model.provider_id) : null;

  logger.debug(`模型: ${model.display_name} (${model.model_name}), 供应商: ${provider?.name || "无"}`);

  // 检测推理模型并给出警告
  const isReasoningModel =
    model.model_name.includes("preview") ||
    model.model_name.includes("reasoning") ||
    model.model_name.includes("o1") ||
    model.model_name.includes("o3");
  if (isReasoningModel) {
    logger.warn(
      `检测到推理模型 (${model.model_name})，可能不适合简单的文件重命名任务，建议使用普通模型`,
    );
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
    { role: "user" as const, content: userMessage },
  ];

  const startTime = Date.now();
  const result = await callChatModel(config, messages, {
    temperature: 0.7,
    maxTokens: 500, // 增加 token 限制，给推理模型足够空间
  });
  const duration = Date.now() - startTime;

  logger.info(`AI 模型响应成功 - 耗时: ${duration}ms`);
  logger.debug(`AI 原始响应:`, JSON.stringify(result.raw, null, 2));

  // 解析响应
  const finishReason = result.finish_reason;
  if (finishReason === "length") {
    logger.warn(`AI 响应被截断 (finish_reason: ${finishReason})，可能无法获得完整答案`);
  }

  const suggestedName = parseAiResponse(result.content, finishReason);
  logger.debug(`AI 返回内容: "${suggestedName}"`);

  // 检查是否为空响应
  if (!suggestedName) {
    logger.warn("AI 模型返回了空响应");
    throw new Error("AI 模型返回了空响应，请稍后重试或更换模型");
  }

  // 检查是否返回 UNKNOWN
  if (suggestedName.toUpperCase() === "UNKNOWN") {
    logger.info("AI 返回 UNKNOWN，表示无法判断更好的名称");
  } else {
    logger.info(`智能重命名成功 - 原名称: "${fileName}", 建议名称: "${suggestedName}"`);
  }

  return {
    suggestedName,
    originalName: fileName,
    extension: fileExtension || null,
  };
};
