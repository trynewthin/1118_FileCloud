/**
 * 智能重命名模块类型定义
 */

// 智能重命名请求参数
export interface SmartRenameRequest {
  fileName: string;
  fileExtension?: string;
  modelId?: number;
  entryId?: string;
}

// 智能重命名结果
export interface SmartRenameResult {
  suggestedName: string;
  originalName: string;
  extension: string | null;
}

// 文件上下文信息
export interface FileContextInfo {
  parentName?: string;
  isRoot?: boolean;
  siblingNames?: string[];
}
