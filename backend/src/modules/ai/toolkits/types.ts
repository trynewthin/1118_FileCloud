/**
 * AI 工具包（ToolKit）核心类型定义
 * 
 * 工具包是一组相关工具的集合，支持：
 * - 按包启用/禁用
 * - 系统默认 + 会话覆盖的配置策略
 * - 权限控制
 */

import type { ChatToolDefinition } from "../../../core/ai/client.ts";

// ============================================================================
// 工具类型定义
// ============================================================================

/**
 * 工具调用类型
 * - view: 查看类工具，不需要用户确认
 * - modify: 修改类工具，需要用户确认后执行
 */
export type ToolCallType = "view" | "modify";

/**
 * 工具执行上下文
 */
export interface ToolExecutionContext {
  userId: number;
  conversationId: number;
  conversationVars: Record<string, any>;
}

/**
 * 工具执行结果
 */
export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  updatedVars?: Record<string, any>;
  pendingAction?: {
    toolName: string;
    description: string;
    args: Record<string, any>;
  };
}

/**
 * 工具执行器函数类型
 */
export type ToolExecutor = (
  args: Record<string, any>,
  context: ToolExecutionContext,
) => Promise<ToolExecutionResult>;

/**
 * 单个工具定义
 */
export interface ToolDefinition {
  /** 工具名称（全局唯一，对应 OpenAI function name） */
  name: string;
  /** 工具调用类型 */
  callType: ToolCallType;
  /** OpenAI 格式的工具定义 */
  definition: ChatToolDefinition;
  /** 工具执行器 */
  executor: ToolExecutor;
}

// ============================================================================
// 工具包类型定义
// ============================================================================

/**
 * 工具包元信息
 */
export interface ToolKitMeta {
  /** 工具包唯一标识 */
  key: string;
  /** 显示名称 */
  displayName: string;
  /** 描述 */
  description: string;
  /** 图标名称（前端用） */
  icon?: string;
  /** 是否默认启用 */
  defaultEnabled: boolean;
  /** 所需权限等级（可选，用于限制某些工具包只对管理员可用） */
  requiredPermission?: "user" | "admin" | "system";
  /** 排序权重（越小越靠前） */
  order?: number;
}

/**
 * 完整的工具包定义
 */
export interface ToolKit {
  /** 工具包元信息 */
  meta: ToolKitMeta;
  /** 工具包内的工具列表 */
  tools: ToolDefinition[];
}

// ============================================================================
// 会话工具包配置
// ============================================================================

/**
 * 会话工具包配置模式
 * - inherit: 继承系统默认，可通过 disabled 排除某些工具包
 * - override: 完全自定义，只启用 enabled 中指定的工具包
 */
export type ToolKitsConfigMode = "inherit" | "override";

/**
 * 会话级工具包配置（存储在会话 metadata 中）
 */
export interface ToolKitsConfig {
  /** 配置模式 */
  mode: ToolKitsConfigMode;
  /** override 模式下启用的工具包 key 列表 */
  enabled?: string[];
  /** inherit 模式下禁用的工具包 key 列表（黑名单） */
  disabled?: string[];
}

// ============================================================================
// API 响应类型
// ============================================================================

/**
 * 工具包列表项（API 返回用）
 */
export interface ToolKitListItem {
  key: string;
  displayName: string;
  description: string;
  icon?: string;
  defaultEnabled: boolean;
  requiredPermission?: string;
  toolCount: number;
  order?: number;
}

/**
 * 工具包详情（包含工具列表）
 */
export interface ToolKitDetail extends ToolKitListItem {
  tools: Array<{
    name: string;
    callType: ToolCallType;
    description: string;
  }>;
}
