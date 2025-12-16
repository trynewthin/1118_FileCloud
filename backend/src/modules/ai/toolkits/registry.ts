/**
 * 工具包注册中心
 * 
 * 负责：
 * - 工具包的注册与管理
 * - 工具的查找与执行
 * - 根据配置装配启用的工具
 */

import type {
  ToolKit,
  ToolKitMeta,
  ToolDefinition,
  ToolKitListItem,
  ToolKitsConfig,
  ToolExecutionContext,
  ToolExecutionResult,
} from "./types.ts";
import type { ChatToolDefinition } from "../../../core/ai/client.ts";
import { getSetting } from "../../settings/service.ts";

// ============================================================================
// 内部存储
// ============================================================================

/** 工具包注册表：key -> ToolKit */
const toolkitRegistry: Map<string, ToolKit> = new Map();

/** 工具注册表：toolName -> { toolkit, tool } */
const toolRegistry: Map<string, { toolkit: ToolKit; tool: ToolDefinition }> = new Map();

// ============================================================================
// 注册 API
// ============================================================================

/**
 * 注册一个工具包
 */
export const registerToolKit = (toolkit: ToolKit): void => {
  const { key } = toolkit.meta;

  if (toolkitRegistry.has(key)) {
    console.warn(`[ToolKitRegistry] 工具包 "${key}" 已存在，将被覆盖`);
  }

  toolkitRegistry.set(key, toolkit);

  // 注册工具包内的所有工具
  for (const tool of toolkit.tools) {
    if (toolRegistry.has(tool.name)) {
      console.warn(`[ToolKitRegistry] 工具 "${tool.name}" 已存在，将被覆盖`);
    }
    toolRegistry.set(tool.name, { toolkit, tool });
  }
};

/**
 * 批量注册工具包
 */
export const registerToolKits = (toolkits: ToolKit[]): void => {
  for (const toolkit of toolkits) {
    registerToolKit(toolkit);
  }
};

// ============================================================================
// 查询 API
// ============================================================================

/**
 * 获取所有已注册的工具包
 */
export const getAllToolKits = (): ToolKit[] => {
  return Array.from(toolkitRegistry.values());
};

/**
 * 根据 key 获取工具包
 */
export const getToolKitByKey = (key: string): ToolKit | undefined => {
  return toolkitRegistry.get(key);
};

/**
 * 根据工具名获取工具及其所属工具包
 */
export const getToolByName = (
  name: string,
): { toolkit: ToolKit; tool: ToolDefinition } | undefined => {
  return toolRegistry.get(name);
};

/**
 * 获取工具包列表（用于 API 返回）
 */
export const getToolKitList = (): ToolKitListItem[] => {
  const toolkits = getAllToolKits();

  return toolkits
    .map((tk) => ({
      key: tk.meta.key,
      displayName: tk.meta.displayName,
      description: tk.meta.description,
      icon: tk.meta.icon,
      defaultEnabled: tk.meta.defaultEnabled,
      requiredPermission: tk.meta.requiredPermission,
      toolCount: tk.tools.length,
      order: tk.meta.order ?? 100,
    }))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
};

// ============================================================================
// 配置与装配
// ============================================================================

/** 系统默认工具包设置键 */
const SETTING_KEY_DEFAULT_TOOLKITS = "ai.chat.toolkits.defaultEnabled";

/**
 * 获取系统默认启用的工具包 key 列表
 */
export const getSystemDefaultToolKits = (): string[] => {
  // 优先从设置中读取
  const settingValue = getSetting(SETTING_KEY_DEFAULT_TOOLKITS);
  if (settingValue) {
    try {
      const parsed = JSON.parse(settingValue);
      if (Array.isArray(parsed)) {
        return parsed.filter((k) => typeof k === "string");
      }
    } catch {
      // 解析失败，使用代码默认
    }
  }

  // 回退到代码中标记为 defaultEnabled 的工具包
  return getAllToolKits()
    .filter((tk) => tk.meta.defaultEnabled)
    .map((tk) => tk.meta.key);
};

/**
 * 根据会话配置计算最终启用的工具包 key 列表
 * 
 * @param config 会话级工具包配置（可选）
 * @param userPermission 用户权限等级
 */
export const resolveEnabledToolKitKeys = (
  config?: ToolKitsConfig | null,
  userPermission: "user" | "admin" | "system" = "user",
): string[] => {
  const allToolkits = getAllToolKits();
  const systemDefaults = getSystemDefaultToolKits();

  let enabledKeys: string[];

  if (!config || config.mode === "inherit") {
    // 继承模式：系统默认 - 黑名单
    const disabled = new Set(config?.disabled ?? []);
    enabledKeys = systemDefaults.filter((k) => !disabled.has(k));
  } else {
    // 覆盖模式：只启用指定的
    enabledKeys = config.enabled ?? [];
  }

  // 权限过滤：移除用户无权使用的工具包
  const permissionOrder: Record<string, number> = {
    user: 1,
    admin: 2,
    system: 3,
  };
  const userLevel = permissionOrder[userPermission] ?? 1;

  return enabledKeys.filter((key) => {
    const toolkit = toolkitRegistry.get(key);
    if (!toolkit) return false;

    const requiredLevel =
      permissionOrder[toolkit.meta.requiredPermission ?? "user"] ?? 1;
    return userLevel >= requiredLevel;
  });
};

/**
 * 根据启用的工具包 key 列表，装配出 OpenAI tools 数组
 */
export const assembleToolDefinitions = (
  enabledToolKitKeys: string[],
): ChatToolDefinition[] => {
  const definitions: ChatToolDefinition[] = [];

  for (const key of enabledToolKitKeys) {
    const toolkit = toolkitRegistry.get(key);
    if (!toolkit) continue;

    for (const tool of toolkit.tools) {
      definitions.push(tool.definition);
    }
  }

  return definitions;
};

/**
 * 一站式：根据会话配置和用户权限，返回可用的 tools 定义
 */
export const getEnabledToolDefinitions = (
  config?: ToolKitsConfig | null,
  userPermission: "user" | "admin" | "system" = "user",
): ChatToolDefinition[] => {
  const enabledKeys = resolveEnabledToolKitKeys(config, userPermission);
  return assembleToolDefinitions(enabledKeys);
};

// ============================================================================
// 工具执行
// ============================================================================

/**
 * 执行工具
 * 
 * @param name 工具名
 * @param args 工具参数
 * @param context 执行上下文
 * @param enabledToolKitKeys 当前会话启用的工具包（用于校验）
 */
export const executeTool = async (
  name: string,
  args: Record<string, any>,
  context: ToolExecutionContext,
  enabledToolKitKeys?: string[],
): Promise<ToolExecutionResult> => {
  const entry = toolRegistry.get(name);

  if (!entry) {
    return { success: false, error: `未知工具: ${name}` };
  }

  // 如果提供了启用列表，校验工具所属工具包是否启用
  if (enabledToolKitKeys && !enabledToolKitKeys.includes(entry.toolkit.meta.key)) {
    return {
      success: false,
      error: `工具 "${name}" 所属的工具包 "${entry.toolkit.meta.displayName}" 未启用`,
    };
  }

  try {
    return await entry.tool.executor(args, context);
  } catch (err: any) {
    return { success: false, error: err?.message || "工具执行失败" };
  }
};

/**
 * 检查工具是否属于某个工具包
 */
export const isToolInToolKit = (toolName: string, toolkitKey: string): boolean => {
  const entry = toolRegistry.get(toolName);
  return entry?.toolkit.meta.key === toolkitKey;
};

/**
 * 获取工具所属的工具包 key
 */
export const getToolKitKeyByToolName = (toolName: string): string | undefined => {
  return toolRegistry.get(toolName)?.toolkit.meta.key;
};
