/**
 * AI 工具类型定义（兼容层）
 * 
 * 注意：工具的实际实现已迁移到 toolkits/ 目录
 * 此文件保留类型定义以兼容 orchestrator 等模块
 */

export type AiToolType = "pre" | "post";

export type AiVariableScope = "conversation" | "message";

export interface AiVariableValue {
  kind: string;
  value: any;
}

export interface AiVariableCollection {
  [key: string]: AiVariableValue | undefined;
}

export interface AiVariableContext {
  conversationVars: AiVariableCollection;
  messageVars: AiVariableCollection;
}

export interface AiToolVariableSpec {
  key: string;
  scope: AiVariableScope;
  kind: string;
}

export interface AiToolDefinition {
  key: string;
  type: AiToolType;
  requiredVars?: AiToolVariableSpec[];
  producedVars?: AiToolVariableSpec[];
}

// ============================================================================
// 内置工具定义（用于 orchestrator 兼容）
// ============================================================================

export const BUILTIN_AI_TOOLS: AiToolDefinition[] = [
  { key: "list_libraries", type: "post" },
  { key: "list_directory", type: "post" },
  { key: "get_file_info", type: "post" },
  { key: "search_files", type: "post" },
  { key: "show_files", type: "post" },
  { key: "rename_file", type: "post" },
  { key: "move_file", type: "post" },
  { key: "delete_file", type: "post" },
  { key: "get_current_time", type: "post" },
];
