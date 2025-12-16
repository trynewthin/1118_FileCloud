import { apiClient } from "./client";

export interface AiChatConversation {
  id: number;
  user_id: number;
  model_id: number;
  title: string | null;
  metadata: any | null;
  system_prompt: string | null;
  max_context_messages: number | null;
  memory_enabled: boolean;
  memory_strategy: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface AiChatMessage {
  id: number;
  conversation_id: number;
  role: string;
  content: string | null;
  tool_name: string | null;
  payload: any | null;
  created_at: string;
}

export interface ListAiConversationsResponse {
  items: AiChatConversation[];
}

export interface ListAiMessagesResponse {
  items: AiChatMessage[];
}

export interface CreateAiConversationRequest {
  modelId?: number;
  title?: string | null;
  metadata?: any;
  systemPrompt?: string | null;
  maxContextMessages?: number | null;
  memoryEnabled?: boolean;
  memoryStrategy?: string | null;
}

// 工具包配置类型
export type ToolKitsConfigMode = "inherit" | "override";

export interface ToolKitsConfig {
  mode: ToolKitsConfigMode;
  enabled?: string[];
  disabled?: string[];
}

export interface UpdateAiConversationRequest {
  modelId?: number;
  title?: string | null;
  metadata?: any;
  systemPrompt?: string | null;
  maxContextMessages?: number | null;
  memoryEnabled?: boolean;
  memoryStrategy?: string | null;
  isArchived?: boolean;
  toolkitsConfig?: ToolKitsConfig;
}

export interface AppendMessageRequest {
  content: string;
  attachmentIds?: number[];
}

// ============================================================================
// 会话文件服务
// ============================================================================

export type ConversationFileOrigin = "upload" | "tool_generated" | "system";
export type ConversationFilePurpose = "image" | "markdown" | "text" | "attachment" | "other";

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
  contentUrl?: string;
  previewUrl?: string;
}

export interface UploadFilesResult {
  id: number;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number;
  purpose: string;
}

export interface UploadFilesResponse {
  uploads: UploadFilesResult[];
}

export interface ListConversationFilesResponse {
  items: ConversationFileInfo[];
}

export interface BatchGetFilesResponse {
  items: ConversationFileInfo[];
}

export interface AppendMessageResponse {
  userMessage: AiChatMessage;
  assistantMessage: AiChatMessage;
}

export const listAiConversations = async (): Promise<ListAiConversationsResponse> => {
  return apiClient.get<ListAiConversationsResponse>("/ai/conversations");
};

export const createAiConversation = async (
  body: CreateAiConversationRequest,
): Promise<{ conversation: AiChatConversation }> => {
  return apiClient.post<{ conversation: AiChatConversation }>("/ai/conversations", body as any);
};

export const updateAiConversation = async (
  id: number,
  body: UpdateAiConversationRequest,
): Promise<{ conversation: AiChatConversation }> => {
  return apiClient.patch<{ conversation: AiChatConversation }>(
    `/ai/conversations/${id}`,
    body as any,
  );
};

export const deleteAiConversation = async (id: number): Promise<void> => {
  await apiClient.delete<unknown>(`/ai/conversations/${id}`);
};

export const listAiMessages = async (
  conversationId: number,
): Promise<ListAiMessagesResponse> => {
  return apiClient.get<ListAiMessagesResponse>(`/ai/conversations/${conversationId}/messages`);
};

export const appendUserMessage = async (
  conversationId: number,
  body: AppendMessageRequest,
): Promise<AppendMessageResponse> => {
  return apiClient.post<AppendMessageResponse>(
    `/ai/conversations/${conversationId}/messages`,
    body,
  );
};

// 上传文件到会话
export const uploadConversationFiles = async (
  files: File[],
  conversationId?: number,
): Promise<UploadFilesResponse> => {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  if (conversationId) {
    formData.append("conversationId", String(conversationId));
  }
  return apiClient.post<UploadFilesResponse>("/ai/files", formData);
};

// 获取单个文件信息
export const getConversationFile = async (
  fileId: number,
): Promise<{ file: ConversationFileInfo }> => {
  return apiClient.get<{ file: ConversationFileInfo }>(`/ai/files/${fileId}`);
};

// 列出会话文件
export const listConversationFiles = async (
  conversationId: number,
  options?: { purpose?: ConversationFilePurpose; limit?: number; offset?: number },
): Promise<ListConversationFilesResponse> => {
  const params = new URLSearchParams();
  if (options?.purpose) params.append("purpose", options.purpose);
  if (options?.limit) params.append("limit", String(options.limit));
  if (options?.offset) params.append("offset", String(options.offset));
  const query = params.toString();
  const url = `/ai/files/conversations/${conversationId}/files${query ? `?${query}` : ""}`;
  return apiClient.get<ListConversationFilesResponse>(url);
};

// 批量获取文件信息
export const batchGetConversationFiles = async (
  ids: number[],
): Promise<BatchGetFilesResponse> => {
  return apiClient.post<BatchGetFilesResponse>("/ai/files/batch", { ids });
};

// 构建文件内容 URL（带 token）
export const buildFileContentUrl = (fileId: number, token: string): string => {
  return `/api/ai/files/${fileId}/content?token=${encodeURIComponent(token)}`;
};

// 构建文件下载 URL（带 token）
export const buildFileDownloadUrl = (fileId: number, token: string): string => {
  return `/api/ai/files/${fileId}/content?token=${encodeURIComponent(token)}&disposition=attachment`;
};

// 执行工具操作
export interface ExecuteToolRequest {
  toolName: string;
  args: Record<string, any>;
  conversationId?: number;
}

export interface ExecuteToolResponse {
  success: boolean;
  message: string;
}

export const executeAiTool = async (
  request: ExecuteToolRequest,
): Promise<ExecuteToolResponse> => {
  return apiClient.post<ExecuteToolResponse>("/ai/tools/execute", request);
};

// 智能重命名
export interface SmartRenameRequest {
  fileName: string;
  fileExtension?: string;
  modelId?: number;
  entryId?: string;
}

export interface SmartRenameResponse {
  suggestedName: string;
  originalName: string;
  extension: string | null;
}

export const smartRename = async (
  request: SmartRenameRequest,
): Promise<SmartRenameResponse> => {
  return apiClient.post<SmartRenameResponse>("/ai/smart-rename", request);
};

// 工具包列表
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

export interface ListToolKitsResponse {
  items: ToolKitListItem[];
}

export const listToolKits = async (): Promise<ListToolKitsResponse> => {
  return apiClient.get<ListToolKitsResponse>("/ai/toolkits");
};
