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

export interface UpdateAiConversationRequest {
  modelId?: number;
  title?: string | null;
  metadata?: any;
  systemPrompt?: string | null;
  maxContextMessages?: number | null;
  memoryEnabled?: boolean;
  memoryStrategy?: string | null;
  isArchived?: boolean;
}

export interface AppendMessageRequest {
  content: string;
  attachmentIds?: number[];
}

export interface UploadResult {
  id: number;
  originalName: string;
}

export interface UploadResponse {
  uploads: UploadResult[];
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

// 上传图片附件
export const uploadAiImages = async (files: File[]): Promise<UploadResponse> => {
  const formData = new FormData();
  for (const file of files) {
    formData.append("images", file);
  }

  // 使用 apiClient 的 post 方法，支持 FormData
  return apiClient.post<UploadResponse>("/ai/uploads", formData);
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
