// ============================================================================
// AI 会话文件服务 - 类型定义
// ============================================================================

// 文件来源
export type ConversationFileOrigin = "upload" | "tool_generated" | "system";

// 文件用途
export type ConversationFilePurpose = "image" | "markdown" | "text" | "attachment" | "other";

// 数据库实体
export interface ConversationFile {
  id: number;
  user_id: number;
  conversation_id: number | null;
  message_id: number | null;
  origin: ConversationFileOrigin;
  purpose: ConversationFilePurpose;
  original_name: string;
  stored_name: string;
  extension: string | null;
  mime_type: string | null;
  size_bytes: number;
  relative_path: string;
  sha256: string | null;
  created_at: string;
  deleted_at: string | null;
}

// 创建文件输入
export interface CreateConversationFileInput {
  userId: number;
  conversationId?: number | null;
  messageId?: number | null;
  origin: ConversationFileOrigin;
  purpose: ConversationFilePurpose;
  originalName: string;
  storedName: string;
  extension?: string | null;
  mimeType?: string | null;
  sizeBytes: number;
  relativePath: string;
  sha256?: string | null;
}

// 文件列表查询选项
export interface ListConversationFilesOptions {
  conversationId?: number;
  userId?: number;
  purpose?: ConversationFilePurpose;
  origin?: ConversationFileOrigin;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

// 前端返回的文件信息
export interface ConversationFileInfo {
  id: number;
  conversationId: number | null;
  messageId: number | null;
  origin: ConversationFileOrigin;
  purpose: ConversationFilePurpose;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: string;
  // URL 由路由层生成
  contentUrl?: string;
  previewUrl?: string;
}
