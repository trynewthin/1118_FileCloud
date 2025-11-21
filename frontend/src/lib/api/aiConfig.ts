import { apiClient } from "./client";

// 供应商
export interface AiProvider {
  id: number;
  name: string;
  base_url: string;
  api_key: string | null;
  api_type: string;
  extra_headers_json: string | null;
  timeout_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface ListAiProvidersResponse {
  items: AiProvider[];
}

export interface CreateAiProviderRequest {
  name: string;
  baseUrl: string;
  apiKey?: string | null;
  apiType: string;
  extraHeadersJson?: string | null;
  timeoutMs?: number | null;
}

export interface UpdateAiProviderRequest {
  name?: string;
  baseUrl?: string;
  apiKey?: string | null;
  apiType?: string;
  extraHeadersJson?: string | null;
  timeoutMs?: number | null;
}

export const listAiProviders = async (): Promise<ListAiProvidersResponse> => {
  return apiClient.get<ListAiProvidersResponse>("/ai/providers");
};

export const createAiProvider = async (
  body: CreateAiProviderRequest,
): Promise<{ provider: AiProvider }> => {
  return apiClient.post<{ provider: AiProvider }>("/ai/providers", body);
};

export const updateAiProvider = async (
  id: number,
  body: UpdateAiProviderRequest,
): Promise<{ provider: AiProvider }> => {
  return apiClient.put<{ provider: AiProvider }>(`/ai/providers/${id}`, body);
};

export const deleteAiProvider = async (id: number): Promise<void> => {
  await apiClient.delete<unknown>(`/ai/providers/${id}`);
};

// 模型
export interface AiChatModel {
  id: number;
  key: string;
  display_name: string;
  provider_id: number | null;
  model_name: string;
  api_mode: string;
  capabilities: string[];
  default_max_context_messages: number | null;
  allow_override_context_limit: boolean;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListAiChatModelsResponse {
  items: AiChatModel[];
}

export interface CreateAiChatModelRequest {
  key: string;
  displayName: string;
  providerId?: number | null;
  modelName: string;
  apiMode: string;
  capabilities?: string[];
  defaultMaxContextMessages?: number | null;
  allowOverrideContextLimit?: boolean;
  isEnabled?: boolean;
}

export interface UpdateAiChatModelRequest {
  displayName?: string;
  providerId?: number | null;
  modelName?: string;
  apiMode?: string;
  capabilities?: string[];
  defaultMaxContextMessages?: number | null;
  allowOverrideContextLimit?: boolean;
  isEnabled?: boolean;
}

export const listAiChatModels = async (): Promise<ListAiChatModelsResponse> => {
  return apiClient.get<ListAiChatModelsResponse>("/ai/models");
};

export const createAiChatModel = async (
  body: CreateAiChatModelRequest,
): Promise<{ model: AiChatModel }> => {
  return apiClient.post<{ model: AiChatModel }>("/ai/models", body as any);
};

export const updateAiChatModel = async (
  id: number,
  body: UpdateAiChatModelRequest,
): Promise<{ model: AiChatModel }> => {
  return apiClient.put<{ model: AiChatModel }>(`/ai/models/${id}`, body as any);
};

export const deleteAiChatModel = async (id: number): Promise<void> => {
  await apiClient.delete<unknown>(`/ai/models/${id}`);
};

// 提示词
export interface AiChatPrompt {
  id: number;
  title: string;
  content: string;
  scope: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListAiChatPromptsResponse {
  items: AiChatPrompt[];
}

export interface CreateAiChatPromptRequest {
  title: string;
  content: string;
  scope?: string | null;
  isDefault?: boolean;
}

export interface UpdateAiChatPromptRequest {
  title?: string;
  content?: string;
  scope?: string | null;
  isDefault?: boolean;
}

export const listAiChatPrompts = async (): Promise<ListAiChatPromptsResponse> => {
  return apiClient.get<ListAiChatPromptsResponse>("/ai/prompts");
};

export const createAiChatPrompt = async (
  body: CreateAiChatPromptRequest,
): Promise<{ prompt: AiChatPrompt }> => {
  return apiClient.post<{ prompt: AiChatPrompt }>("/ai/prompts", body as any);
};

export const updateAiChatPrompt = async (
  id: number,
  body: UpdateAiChatPromptRequest,
): Promise<{ prompt: AiChatPrompt }> => {
  return apiClient.put<{ prompt: AiChatPrompt }>(`/ai/prompts/${id}`, body as any);
};

export const deleteAiChatPrompt = async (id: number): Promise<void> => {
  await apiClient.delete<unknown>(`/ai/prompts/${id}`);
};
