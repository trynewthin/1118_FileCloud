import { db } from "../../core/db/index.ts";
import type { ChatMessageInput, ChatResult, ChatCallOptions, ChatAttachment } from "../../core/ai/client.ts";
import { callChatModel } from "../../core/ai/client.ts";
import { getSetting } from "../settings/service.ts";
import { buildVariableContext } from "./orchestrator.ts";
import { buildImageAttachmentsFromUploadIds } from "./attachments.ts";
import {
  initializeToolKits,
  getEnabledToolDefinitions,
  executeTool,
  resolveEnabledToolKitKeys,
  type ToolKitsConfig,
} from "./toolkits/index.ts";

// 初始化工具包系统
initializeToolKits();

// 供应商实体
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

const mapRowToProvider = (row: any): AiProvider => {
  return {
    id: row.id,
    name: row.name,
    base_url: row.base_url,
    api_key: row.api_key ?? null,
    api_type: row.api_type,
    extra_headers_json: row.extra_headers_json ?? null,
    timeout_ms: row.timeout_ms ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

export const listAiProviders = (): AiProvider[] => {
  const rows = db
    .prepare(
      "SELECT id, name, base_url, api_key, api_type, extra_headers_json, timeout_ms, created_at, updated_at FROM ai_providers ORDER BY id ASC",
    )
    .all() as any[];

  return rows.map(mapRowToProvider);
};

export const getAiProviderById = (id: number): AiProvider | null => {
  const row = db
    .prepare(
      "SELECT id, name, base_url, api_key, api_type, extra_headers_json, timeout_ms, created_at, updated_at FROM ai_providers WHERE id = ?",
    )
    .get(id) as any | undefined;

  if (!row) return null;
  return mapRowToProvider(row);
};

export interface CreateAiProviderInput {
  name: string;
  baseUrl: string;
  apiKey?: string | null;
  apiType: string;
  extraHeadersJson?: string | null;
  timeoutMs?: number | null;
}

export const createAiProvider = (input: CreateAiProviderInput): AiProvider => {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    "INSERT INTO ai_providers(name, base_url, api_key, api_type, extra_headers_json, timeout_ms, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
  );

  const result = stmt.run(
    input.name,
    input.baseUrl,
    input.apiKey ?? null,
    input.apiType,
    input.extraHeadersJson ?? null,
    input.timeoutMs ?? null,
    now,
    now,
  );

  const id = Number(result.lastInsertRowid);
  return getAiProviderById(id)!;
};

export interface UpdateAiProviderInput {
  name?: string;
  baseUrl?: string;
  apiKey?: string | null;
  apiType?: string;
  extraHeadersJson?: string | null;
  timeoutMs?: number | null;
}

export const updateAiProvider = (
  id: number,
  input: UpdateAiProviderInput,
): AiProvider | null => {
  const existing = getAiProviderById(id);
  if (!existing) return null;

  const nextName =
    typeof input.name === "string" && input.name.trim().length > 0
      ? input.name.trim()
      : existing.name;
  const nextBaseUrl =
    typeof input.baseUrl === "string" && input.baseUrl.trim().length > 0
      ? input.baseUrl.trim()
      : existing.base_url;
  const nextApiKey = input.apiKey === undefined ? existing.api_key : input.apiKey;
  const nextApiType =
    typeof input.apiType === "string" && input.apiType.trim().length > 0
      ? input.apiType.trim()
      : existing.api_type;
  const nextExtraHeadersJson =
    input.extraHeadersJson === undefined
      ? existing.extra_headers_json
      : input.extraHeadersJson;
  const nextTimeoutMs =
    input.timeoutMs === undefined ? existing.timeout_ms : input.timeoutMs;

  const now = new Date().toISOString();

  db.prepare(
    "UPDATE ai_providers SET name = ?, base_url = ?, api_key = ?, api_type = ?, extra_headers_json = ?, timeout_ms = ?, updated_at = ? WHERE id = ?",
  ).run(
    nextName,
    nextBaseUrl,
    nextApiKey ?? null,
    nextApiType,
    nextExtraHeadersJson ?? null,
    nextTimeoutMs ?? null,
    now,
    id,
  );

  return getAiProviderById(id);
};

export const deleteAiProvider = (id: number): boolean => {
  const stmt = db.prepare("DELETE FROM ai_providers WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
};

// 模型实体
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

const mapRowToChatModel = (row: any): AiChatModel => {
  let capabilities: string[] = [];
  if (row.capabilities_json) {
    try {
      const parsed = JSON.parse(row.capabilities_json);
      if (Array.isArray(parsed)) {
        capabilities = parsed.map((v) => String(v));
      }
    } catch {
      capabilities = [];
    }
  }

  return {
    id: row.id,
    key: row.key,
    display_name: row.display_name,
    provider_id: row.provider_id ?? null,
    model_name: row.model_name,
    api_mode: row.api_mode,
    capabilities,
    default_max_context_messages: row.default_max_context_messages ?? null,
    allow_override_context_limit: Boolean(row.allow_override_context_limit),
    is_enabled: Boolean(row.is_enabled),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

export const listAiChatModels = (): AiChatModel[] => {
  const rows = db
    .prepare(
      "SELECT id, key, display_name, provider_id, model_name, api_mode, capabilities_json, default_max_context_messages, allow_override_context_limit, is_enabled, created_at, updated_at FROM ai_chat_models ORDER BY id ASC",
    )
    .all() as any[];

  return rows.map(mapRowToChatModel);
};

export const getAiChatModelById = (id: number): AiChatModel | null => {
  const row = db
    .prepare(
      "SELECT id, key, display_name, provider_id, model_name, api_mode, capabilities_json, default_max_context_messages, allow_override_context_limit, is_enabled, created_at, updated_at FROM ai_chat_models WHERE id = ?",
    )
    .get(id) as any | undefined;

  if (!row) return null;
  return mapRowToChatModel(row);
};

export interface CreateAiChatModelInput {
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

export const createAiChatModel = (input: CreateAiChatModelInput): AiChatModel => {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    "INSERT INTO ai_chat_models(key, display_name, provider_id, model_name, api_mode, capabilities_json, default_max_context_messages, allow_override_context_limit, is_enabled, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );

  const capabilitiesJson = JSON.stringify(input.capabilities ?? []);

  const result = stmt.run(
    input.key,
    input.displayName,
    input.providerId ?? null,
    input.modelName,
    input.apiMode,
    capabilitiesJson,
    input.defaultMaxContextMessages ?? null,
    input.allowOverrideContextLimit === false ? 0 : 1,
    input.isEnabled === false ? 0 : 1,
    now,
    now,
  );

  const id = Number(result.lastInsertRowid);
  return getAiChatModelById(id)!;
};

export interface UpdateAiChatModelInput {
  displayName?: string;
  providerId?: number | null;
  modelName?: string;
  apiMode?: string;
  capabilities?: string[];
  defaultMaxContextMessages?: number | null;
  allowOverrideContextLimit?: boolean;
  isEnabled?: boolean;
}

export const updateAiChatModel = (
  id: number,
  input: UpdateAiChatModelInput,
): AiChatModel | null => {
  const existing = getAiChatModelById(id);
  if (!existing) return null;

  const nextDisplayName =
    typeof input.displayName === "string" && input.displayName.trim().length > 0
      ? input.displayName.trim()
      : existing.display_name;
  const nextProviderId =
    input.providerId === undefined ? existing.provider_id : input.providerId;
  const nextModelName =
    typeof input.modelName === "string" && input.modelName.trim().length > 0
      ? input.modelName.trim()
      : existing.model_name;
  const nextApiMode =
    typeof input.apiMode === "string" && input.apiMode.trim().length > 0
      ? input.apiMode.trim()
      : existing.api_mode;
  const nextCapabilities =
    input.capabilities === undefined ? existing.capabilities : input.capabilities;
  const nextDefaultMaxContextMessages =
    input.defaultMaxContextMessages === undefined
      ? existing.default_max_context_messages
      : input.defaultMaxContextMessages;
  const nextAllowOverrideContextLimit =
    input.allowOverrideContextLimit === undefined
      ? existing.allow_override_context_limit
      : input.allowOverrideContextLimit;
  const nextIsEnabled =
    input.isEnabled === undefined ? existing.is_enabled : input.isEnabled;

  const now = new Date().toISOString();

  db.prepare(
    "UPDATE ai_chat_models SET display_name = ?, provider_id = ?, model_name = ?, api_mode = ?, capabilities_json = ?, default_max_context_messages = ?, allow_override_context_limit = ?, is_enabled = ?, updated_at = ? WHERE id = ?",
  ).run(
    nextDisplayName,
    nextProviderId ?? null,
    nextModelName,
    nextApiMode,
    JSON.stringify(nextCapabilities ?? []),
    nextDefaultMaxContextMessages ?? null,
    nextAllowOverrideContextLimit ? 1 : 0,
    nextIsEnabled ? 1 : 0,
    now,
    id,
  );

  return getAiChatModelById(id);
};

export const deleteAiChatModel = (id: number): boolean => {
  const stmt = db.prepare("DELETE FROM ai_chat_models WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
};

// 提示词实体
export interface AiChatPrompt {
  id: number;
  title: string;
  content: string;
  scope: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const mapRowToPrompt = (row: any): AiChatPrompt => {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    scope: row.scope ?? null,
    is_default: Boolean(row.is_default),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

export const listAiChatPrompts = (): AiChatPrompt[] => {
  const rows = db
    .prepare(
      "SELECT id, title, content, scope, is_default, created_at, updated_at FROM ai_chat_prompts ORDER BY created_at DESC",
    )
    .all() as any[];

  return rows.map(mapRowToPrompt);
};

export const getAiChatPromptById = (id: number): AiChatPrompt | null => {
  const row = db
    .prepare(
      "SELECT id, title, content, scope, is_default, created_at, updated_at FROM ai_chat_prompts WHERE id = ?",
    )
    .get(id) as any | undefined;

  if (!row) return null;
  return mapRowToPrompt(row);
};

export const getDefaultAiChatPrompt = (): AiChatPrompt | null => {
  const row = db
    .prepare(
      "SELECT id, title, content, scope, is_default, created_at, updated_at FROM ai_chat_prompts WHERE is_default = 1 ORDER BY id DESC LIMIT 1",
    )
    .get() as any | undefined;

  if (!row) return null;
  return mapRowToPrompt(row);
};

export interface CreateAiChatPromptInput {
  title: string;
  content: string;
  scope?: string | null;
  isDefault?: boolean;
}

export const createAiChatPrompt = (input: CreateAiChatPromptInput): AiChatPrompt => {
  const now = new Date().toISOString();

  if (input.isDefault) {
    db.prepare("UPDATE ai_chat_prompts SET is_default = 0").run();
  }

  const stmt = db.prepare(
    "INSERT INTO ai_chat_prompts(title, content, scope, is_default, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)",
  );

  const result = stmt.run(
    input.title,
    input.content,
    input.scope ?? null,
    input.isDefault ? 1 : 0,
    now,
    now,
  );

  const id = Number(result.lastInsertRowid);
  return getAiChatPromptById(id)!;
};

export interface UpdateAiChatPromptInput {
  title?: string;
  content?: string;
  scope?: string | null;
  isDefault?: boolean;
}

export const updateAiChatPrompt = (
  id: number,
  input: UpdateAiChatPromptInput,
): AiChatPrompt | null => {
  const existing = getAiChatPromptById(id);
  if (!existing) return null;

  if (input.isDefault) {
    db.prepare("UPDATE ai_chat_prompts SET is_default = 0 WHERE id <> ?").run(id);
  }

  const nextTitle =
    typeof input.title === "string" && input.title.trim().length > 0
      ? input.title.trim()
      : existing.title;
  const nextContent =
    typeof input.content === "string" && input.content.trim().length > 0
      ? input.content
      : existing.content;
  const nextScope =
    input.scope === undefined ? existing.scope : input.scope;
  const nextIsDefault =
    input.isDefault === undefined ? existing.is_default : input.isDefault;

  const now = new Date().toISOString();

  db.prepare(
    "UPDATE ai_chat_prompts SET title = ?, content = ?, scope = ?, is_default = ?, updated_at = ? WHERE id = ?",
  ).run(
    nextTitle,
    nextContent,
    nextScope ?? null,
    nextIsDefault ? 1 : 0,
    now,
    id,
  );

  return getAiChatPromptById(id);
};

export const deleteAiChatPrompt = (id: number): boolean => {
  const stmt = db.prepare("DELETE FROM ai_chat_prompts WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
};

// 工具配置实体
export interface AiToolConfig {
  id: number;
  tool_key: string;
  display_name: string;
  description: string | null;
  type: string;
  scope: string | null;
  is_enabled: boolean;
  default_config: any | null;
  override_config: any | null;
  ui_schema: any | null;
  created_at: string;
  updated_at: string;
}

const mapRowToToolConfig = (row: any): AiToolConfig => {
  let defaultConfig: any = null;
  let overrideConfig: any = null;
  let uiSchema: any = null;

  if (row.default_config_json) {
    try {
      defaultConfig = JSON.parse(row.default_config_json);
    } catch {
      defaultConfig = null;
    }
  }

  if (row.override_config_json) {
    try {
      overrideConfig = JSON.parse(row.override_config_json);
    } catch {
      overrideConfig = null;
    }
  }

  if (row.ui_schema_json) {
    try {
      uiSchema = JSON.parse(row.ui_schema_json);
    } catch {
      uiSchema = null;
    }
  }

  return {
    id: row.id,
    tool_key: row.tool_key,
    display_name: row.display_name,
    description: row.description ?? null,
    type: row.type,
    scope: row.scope ?? null,
    is_enabled: Boolean(row.is_enabled),
    default_config: defaultConfig,
    override_config: overrideConfig,
    ui_schema: uiSchema,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

export const listAiToolConfigs = (): AiToolConfig[] => {
  const rows = db
    .prepare(
      "SELECT id, tool_key, display_name, description, type, scope, is_enabled, default_config_json, override_config_json, ui_schema_json, created_at, updated_at FROM ai_tool_configs ORDER BY id ASC",
    )
    .all() as any[];

  return rows.map(mapRowToToolConfig);
};

export const getAiToolConfigByKey = (toolKey: string): AiToolConfig | null => {
  const row = db
    .prepare(
      "SELECT id, tool_key, display_name, description, type, scope, is_enabled, default_config_json, override_config_json, ui_schema_json, created_at, updated_at FROM ai_tool_configs WHERE tool_key = ?",
    )
    .get(toolKey) as any | undefined;

  if (!row) return null;
  return mapRowToToolConfig(row);
};

export interface UpsertAiToolConfigInput {
  displayName?: string;
  description?: string | null;
  type?: string;
  scope?: string | null;
  isEnabled?: boolean;
  defaultConfig?: any;
  overrideConfig?: any;
  uiSchema?: any;
}

export const upsertAiToolConfig = (
  toolKey: string,
  input: UpsertAiToolConfigInput,
): AiToolConfig => {
  const existing = getAiToolConfigByKey(toolKey);
  const now = new Date().toISOString();

  if (!existing) {
    const stmt = db.prepare(
      "INSERT INTO ai_tool_configs(tool_key, display_name, description, type, scope, is_enabled, default_config_json, override_config_json, ui_schema_json, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );

    const displayName =
      typeof input.displayName === "string" && input.displayName.trim().length > 0
        ? input.displayName.trim()
        : toolKey;
    const description =
      input.description === undefined ? null : input.description;
    const type =
      typeof input.type === "string" && input.type.trim().length > 0
        ? input.type.trim()
        : "pre";
    const scope =
      input.scope === undefined ? null : input.scope;
    const isEnabled =
      input.isEnabled === undefined ? 1 : input.isEnabled ? 1 : 0;

    const defaultConfigJson =
      input.defaultConfig === undefined
        ? null
        : JSON.stringify(input.defaultConfig ?? null);
    const overrideConfigJson =
      input.overrideConfig === undefined
        ? null
        : JSON.stringify(input.overrideConfig ?? null);
    const uiSchemaJson =
      input.uiSchema === undefined
        ? null
        : JSON.stringify(input.uiSchema ?? null);

    stmt.run(
      toolKey,
      displayName,
      description,
      type,
      scope,
      isEnabled,
      defaultConfigJson,
      overrideConfigJson,
      uiSchemaJson,
      now,
      now,
    );

    return getAiToolConfigByKey(toolKey)!;
  }

  const nextDisplayName =
    typeof input.displayName === "string" && input.displayName.trim().length > 0
      ? input.displayName.trim()
      : existing.display_name;
  const nextDescription =
    input.description === undefined ? existing.description : input.description;
  const nextType =
    typeof input.type === "string" && input.type.trim().length > 0
      ? input.type.trim()
      : existing.type;
  const nextScope =
    input.scope === undefined ? existing.scope : input.scope;
  const nextIsEnabled =
    input.isEnabled === undefined ? existing.is_enabled : input.isEnabled;

  const nextDefaultConfigJson =
    input.defaultConfig === undefined
      ? JSON.stringify(existing.default_config ?? null)
      : JSON.stringify(input.defaultConfig ?? null);
  const nextOverrideConfigJson =
    input.overrideConfig === undefined
      ? JSON.stringify(existing.override_config ?? null)
      : JSON.stringify(input.overrideConfig ?? null);
  const nextUiSchemaJson =
    input.uiSchema === undefined
      ? JSON.stringify(existing.ui_schema ?? null)
      : JSON.stringify(input.uiSchema ?? null);

  db.prepare(
    "UPDATE ai_tool_configs SET display_name = ?, description = ?, type = ?, scope = ?, is_enabled = ?, default_config_json = ?, override_config_json = ?, ui_schema_json = ?, updated_at = ? WHERE tool_key = ?",
  ).run(
    nextDisplayName,
    nextDescription,
    nextType,
    nextScope,
    nextIsEnabled ? 1 : 0,
    nextDefaultConfigJson,
    nextOverrideConfigJson,
    nextUiSchemaJson,
    now,
    toolKey,
  );

  return getAiToolConfigByKey(toolKey)!;
};

// 会话实体
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

const mapRowToConversation = (row: any): AiChatConversation => {
  let metadata: any = null;
  if (row.metadata_json) {
    try {
      metadata = JSON.parse(row.metadata_json);
    } catch {
      metadata = null;
    }
  }

  return {
    id: row.id,
    user_id: row.user_id,
    model_id: row.model_id,
    title: row.title ?? null,
    metadata,
    system_prompt: row.system_prompt ?? null,
    max_context_messages: row.max_context_messages ?? null,
    memory_enabled: Boolean(row.memory_enabled),
    memory_strategy: row.memory_strategy ?? null,
    is_archived: Boolean(row.is_archived),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

export const listAiChatConversationsByUser = (
  userId: number,
  options?: { includeArchived?: boolean },
): AiChatConversation[] => {
  const includeArchived = options?.includeArchived ?? false;

  const rows = db
    .prepare(
      includeArchived
        ? "SELECT id, user_id, model_id, title, metadata_json, system_prompt, max_context_messages, memory_enabled, memory_strategy, is_archived, created_at, updated_at FROM ai_chat_conversations WHERE user_id = ? ORDER BY created_at DESC"
        : "SELECT id, user_id, model_id, title, metadata_json, system_prompt, max_context_messages, memory_enabled, memory_strategy, is_archived, created_at, updated_at FROM ai_chat_conversations WHERE user_id = ? AND is_archived = 0 ORDER BY created_at DESC",
    )
    .all(userId) as any[];

  return rows.map(mapRowToConversation);
};

export const getAiChatConversationById = (id: number): AiChatConversation | null => {
  const row = db
    .prepare(
      "SELECT id, user_id, model_id, title, metadata_json, system_prompt, max_context_messages, memory_enabled, memory_strategy, is_archived, created_at, updated_at FROM ai_chat_conversations WHERE id = ?",
    )
    .get(id) as any | undefined;

  if (!row) return null;
  return mapRowToConversation(row);
};

export interface CreateAiChatConversationInput {
  userId: number;
  modelId: number;
  title?: string | null;
  metadata?: any;
  systemPrompt?: string | null;
  maxContextMessages?: number | null;
  memoryEnabled?: boolean;
  memoryStrategy?: string | null;
}

export const createAiChatConversation = (
  input: CreateAiChatConversationInput,
): AiChatConversation => {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    "INSERT INTO ai_chat_conversations(user_id, model_id, title, metadata_json, system_prompt, max_context_messages, memory_enabled, memory_strategy, is_archived, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );

  const metadataJson = input.metadata !== undefined ? JSON.stringify(input.metadata) : null;

  const result = stmt.run(
    input.userId,
    input.modelId,
    input.title ?? null,
    metadataJson,
    input.systemPrompt ?? null,
    input.maxContextMessages ?? null,
    input.memoryEnabled === false ? 0 : 1,
    input.memoryStrategy ?? null,
    0,
    now,
    now,
  );

  const id = Number(result.lastInsertRowid);
  return getAiChatConversationById(id)!;
};

export interface UpdateAiChatConversationInput {
  modelId?: number;
  title?: string | null;
  metadata?: any;
  systemPrompt?: string | null;
  maxContextMessages?: number | null;
  memoryEnabled?: boolean;
  memoryStrategy?: string | null;
  isArchived?: boolean;
}

export const updateAiChatConversation = (
  id: number,
  input: UpdateAiChatConversationInput,
): AiChatConversation | null => {
  const existing = getAiChatConversationById(id);
  if (!existing) return null;

  const nextModelId =
    input.modelId === undefined
      ? existing.model_id
      : input.modelId;

  const nextTitle =
    input.title === undefined
      ? existing.title
      : input.title;
  const nextMetadataJson =
    input.metadata === undefined
      ? JSON.stringify(existing.metadata ?? null)
      : JSON.stringify(input.metadata ?? null);
  const nextSystemPrompt =
    input.systemPrompt === undefined
      ? existing.system_prompt
      : input.systemPrompt;
  const nextMaxContextMessages =
    input.maxContextMessages === undefined
      ? existing.max_context_messages
      : input.maxContextMessages;
  const nextMemoryEnabled =
    input.memoryEnabled === undefined
      ? existing.memory_enabled
      : input.memoryEnabled;
  const nextMemoryStrategy =
    input.memoryStrategy === undefined
      ? existing.memory_strategy
      : input.memoryStrategy;
  const nextIsArchived =
    input.isArchived === undefined
      ? existing.is_archived
      : input.isArchived;

  const now = new Date().toISOString();

  db.prepare(
    "UPDATE ai_chat_conversations SET model_id = ?, title = ?, metadata_json = ?, system_prompt = ?, max_context_messages = ?, memory_enabled = ?, memory_strategy = ?, is_archived = ?, updated_at = ? WHERE id = ?",
  ).run(
    nextModelId,
    nextTitle ?? null,
    nextMetadataJson,
    nextSystemPrompt ?? null,
    nextMaxContextMessages ?? null,
    nextMemoryEnabled ? 1 : 0,
    nextMemoryStrategy ?? null,
    nextIsArchived ? 1 : 0,
    now,
    id,
  );

  return getAiChatConversationById(id);
};

export const deleteAiChatConversation = (id: number): boolean => {
  const stmt = db.prepare("DELETE FROM ai_chat_conversations WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
};

// 消息实体
export interface AiChatMessage {
  id: number;
  conversation_id: number;
  role: string;
  content: string | null;
  tool_name: string | null;
  payload: any | null;
  created_at: string;
}

const mapRowToMessage = (row: any): AiChatMessage => {
  let payload: any = null;
  if (row.payload_json) {
    try {
      payload = JSON.parse(row.payload_json);
    } catch {
      payload = null;
    }
  }

  return {
    id: row.id,
    conversation_id: row.conversation_id,
    role: row.role,
    content: row.content ?? null,
    tool_name: row.tool_name ?? null,
    payload,
    created_at: row.created_at,
  };
};

export const listAiChatMessagesByConversation = (
  conversationId: number,
  options?: { limit?: number; offset?: number },
): AiChatMessage[] => {
  const limit = options?.limit && options.limit > 0 ? options.limit : 50;
  const offset = options?.offset && options.offset >= 0 ? options.offset : 0;

  const rows = db
    .prepare(
      "SELECT id, conversation_id, role, content, tool_name, payload_json, created_at FROM ai_chat_messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?",
    )
    .all(conversationId, limit, offset) as any[];

  return rows.map(mapRowToMessage);
};

export interface CreateAiChatMessageInput {
  conversationId: number;
  role: string;
  content?: string | null;
  toolName?: string | null;
  payload?: any;
}

export const createAiChatMessage = (input: CreateAiChatMessageInput): AiChatMessage => {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    "INSERT INTO ai_chat_messages(conversation_id, role, content, tool_name, payload_json, created_at) VALUES(?, ?, ?, ?, ?, ?)",
  );

  const payloadJson =
    input.payload === undefined ? null : JSON.stringify(input.payload ?? null);

  const result = stmt.run(
    input.conversationId,
    input.role,
    input.content ?? null,
    input.toolName ?? null,
    payloadJson,
    now,
  );

  const row = db
    .prepare(
      "SELECT id, conversation_id, role, content, tool_name, payload_json, created_at FROM ai_chat_messages WHERE id = ?",
    )
    .get(Number(result.lastInsertRowid)) as any;

  return mapRowToMessage(row);
};

// 媒体上传实体
export interface AiChatUpload {
  id: number;
  user_id: number;
  conversation_id: number | null;
  original_name: string;
  extension: string | null;
  mime_type: string | null;
  size_bytes: number;
  storage_rel_path: string;
  created_at: string;
}

const mapRowToUpload = (row: any): AiChatUpload => {
  return {
    id: row.id,
    user_id: row.user_id,
    conversation_id: row.conversation_id ?? null,
    original_name: row.original_name,
    extension: row.extension ?? null,
    mime_type: row.mime_type ?? null,
    size_bytes: row.size_bytes,
    storage_rel_path: row.storage_rel_path,
    created_at: row.created_at,
  };
};

export const getAiChatUploadById = (id: number): AiChatUpload | null => {
  const row = db
    .prepare(
      "SELECT id, user_id, conversation_id, original_name, extension, mime_type, size_bytes, storage_rel_path, created_at FROM ai_chat_uploads WHERE id = ?",
    )
    .get(id) as any | undefined;

  if (!row) return null;
  return mapRowToUpload(row);
};

export interface CreateAiChatUploadInput {
  userId: number;
  conversationId?: number | null;
  originalName: string;
  extension?: string | null;
  mimeType?: string | null;
  sizeBytes: number;
  storageRelPath: string;
}

export const createAiChatUpload = (
  input: CreateAiChatUploadInput,
): AiChatUpload => {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    "INSERT INTO ai_chat_uploads(user_id, conversation_id, original_name, extension, mime_type, size_bytes, storage_rel_path, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
  );

  const result = stmt.run(
    input.userId,
    input.conversationId ?? null,
    input.originalName,
    input.extension ?? null,
    input.mimeType ?? null,
    input.sizeBytes,
    input.storageRelPath,
    now,
  );

  const id = Number(result.lastInsertRowid);
  return getAiChatUploadById(id)!;
};

// 根据供应商记录组装额外请求头
const buildHeadersFromProvider = (provider: AiProvider): Record<string, string> | undefined => {
  if (!provider.extra_headers_json) return undefined;

  try {
    const parsed = JSON.parse(provider.extra_headers_json);
    if (!parsed || typeof parsed !== "object") return undefined;

    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      headers[k] = String(v);
    }
    return headers;
  } catch {
    return undefined;
  }
};

export const getChatModelConfigByModelId = (modelId: number) => {
  const model = getAiChatModelById(modelId);
  if (!model || !model.is_enabled) {
    throw new Error("指定的模型不存在或未启用");
  }

  if (model.provider_id == null) {
    throw new Error("模型未绑定任何供应商，无法调用");
  }

  const provider = getAiProviderById(model.provider_id);
  if (!provider) {
    throw new Error("模型绑定的供应商不存在");
  }

  const headers = buildHeadersFromProvider(provider);

  return {
    baseUrl: provider.base_url,
    apiKey: provider.api_key ?? null,
    apiType: provider.api_type,
    model: model.model_name,
    timeoutMs: provider.timeout_ms ?? null,
    headers,
  };
};

// 对外暴露的统一对话调用：根据模型 ID 与消息列表调用底层模型
export const callChatByModelId = async (
  modelId: number,
  messages: ChatMessageInput[],
  options: ChatCallOptions = {},
): Promise<ChatResult> => {
  const config = getChatModelConfigByModelId(modelId);
  return callChatModel(config, messages, options);
};

// 会话命名相关配置
const DEFAULT_NAMING_CONTEXT_MESSAGES = 1;
const DEFAULT_NAMING_PROMPT =
  "你是会话标题生成器。根据提供的对话内容，生成一个简短的中文标题，概括当前对话的主题。标题不超过 20 个字，不要包含引号或编号，只返回标题本身。";

const getChatNamingConfig = () => {
  const rawContext = getSetting("ai.chat.naming.contextMessages");
  const rawPrompt = getSetting("ai.chat.naming.prompt");

  let contextMessages = DEFAULT_NAMING_CONTEXT_MESSAGES;
  if (rawContext) {
    const parsed = Number(rawContext);
    if (Number.isInteger(parsed) && parsed > 0) {
      contextMessages = parsed;
    }
  }

  const prompt = (rawPrompt && rawPrompt.trim().length > 0)
    ? rawPrompt
    : DEFAULT_NAMING_PROMPT;

  return { contextMessages, prompt };
};

const tryAutoNameConversation = async (conversationId: number) => {
  const conv = getAiChatConversationById(conversationId);
  if (!conv) return;

  // 若标题非空且不以“新会话”开头，则认为已命名，不再自动改名
  if (conv.title && conv.title.trim().length > 0) {
    const trimmed = conv.title.trim();
    if (!trimmed.startsWith("新会话")) {
      return;
    }
  }

  const { contextMessages, prompt } = getChatNamingConfig();

  const history = listAiChatMessagesByConversation(conversationId, {
    limit: Math.max(contextMessages * 2, contextMessages),
    offset: 0,
  });

  const recent = history
    .slice(-contextMessages)
    .filter((m) => m.content && m.content.trim().length > 0);

  if (recent.length === 0) return;

  const summary = recent
    .map((m) => {
      let roleLabel = "用户";
      if (m.role === "assistant") roleLabel = "助手";
      else if (m.role === "system") roleLabel = "系统";
      return `${roleLabel}：${m.content}`;
    })
    .join("\n\n");

  const namingMessages: ChatMessageInput[] = [
    { role: "system", content: prompt },
    { role: "user", content: summary },
  ];

  const result = await callChatByModelId(conv.model_id, namingMessages, {});
  let title = (result.content ?? "").trim();
  if (!title) return;

  // 只取第一行，并做简单清理
  title = title.split(/\r?\n/)[0]?.trim() ?? "";
  // 去掉前缀的 # / 数字 / 点 / 连字符 / 中括号等装饰符号
  title = title.replace(/^[#\d\.\-\s【】\[\]]+/, "");

  if (!title) return;

  // 控制标题长度，避免过长
  if (title.length > 50) {
    title = title.slice(0, 50);
  }

  updateAiChatConversation(conversationId, { title });
};

export interface AppendUserMessageAndReplyInput {
  conversationId: number;
  userId: number;
  content: string;
  attachmentIds?: number[];  // 用户上传的图片 ID 列表
}

export interface AppendUserMessageAndReplyResult {
  userMessage: AiChatMessage;
  assistantMessage: AiChatMessage;
}

// 统一会话对话入口：追加用户消息并调用底层模型获取回复
export const appendUserMessageAndReply = async (
  input: AppendUserMessageAndReplyInput,
): Promise<AppendUserMessageAndReplyResult> => {
  const conv = getAiChatConversationById(input.conversationId);
  if (!conv) {
    throw new Error("会话不存在");
  }

  if (conv.user_id !== input.userId) {
    throw new Error("无权操作该会话");
  }

  if (conv.is_archived) {
    throw new Error("会话已归档，无法继续对话");
  }

  const model = getAiChatModelById(conv.model_id);
  if (!model || !model.is_enabled) {
    throw new Error("会话绑定的模型不存在或未启用");
  }

  // 先写入用户消息，保证历史中包含本次输入
  const userMessage = createAiChatMessage({
    conversationId: conv.id,
    role: "user",
    content: input.content,
    payload: input.attachmentIds && input.attachmentIds.length > 0
      ? { attachmentIds: input.attachmentIds }
      : undefined,
  });

  const maxContext =
    conv.max_context_messages ?? model.default_max_context_messages ?? 20;

  const history = listAiChatMessagesByConversation(conv.id, {
    limit: Math.max(maxContext * 2, maxContext),
    offset: 0,
  });

  const effectiveHistory = history.slice(-maxContext);
  const varContext = buildVariableContext(conv, null);

  let userMessageAttachments: ChatAttachment[] | undefined;

  // 优先使用用户直接上传的图片
  if (input.attachmentIds && input.attachmentIds.length > 0) {
    const attachments = buildImageAttachmentsFromUploadIds(input.attachmentIds);
    if (attachments.length > 0) {
      userMessageAttachments = attachments;
    }
  }

  // 如果没有直接上传的图片，则检查会话变量中的视频帧
  if (!userMessageAttachments) {
    const framesVar = varContext.conversationVars["videoFrames"];
    if (framesVar && framesVar.kind === "image_upload_list" && Array.isArray(framesVar.value)) {
      const attachments = buildImageAttachmentsFromUploadIds(framesVar.value as number[]);
      if (attachments.length > 0) {
        userMessageAttachments = attachments;
      }
    }
  }

  const messagesForAi: ChatMessageInput[] = [];

  let systemPrompt = conv.system_prompt;
  if (!systemPrompt) {
    const defaultPrompt = getDefaultAiChatPrompt();
    if (defaultPrompt && defaultPrompt.content && defaultPrompt.content.trim().length > 0) {
      systemPrompt = defaultPrompt.content;
    }
  }

  if (systemPrompt && systemPrompt.trim().length > 0) {
    messagesForAi.push({ role: "system", content: systemPrompt });
  }

  effectiveHistory.forEach((msg) => {
    if (!msg.content) return;

    let role: "system" | "user" | "assistant";
    if (msg.role === "assistant") {
      role = "assistant";
    } else if (msg.role === "system") {
      role = "system";
    } else {
      role = "user";
    }

    const attachments =
      msg.id === userMessage.id && userMessageAttachments
        ? userMessageAttachments
        : undefined;

    messagesForAi.push({ role, content: msg.content, attachments });
  });

  // 解析会话工具包配置
  const toolkitsConfig = conv.metadata?.toolkitsConfig as ToolKitsConfig | undefined;

  // 根据配置获取启用的工具包和工具定义
  const enabledToolKitKeys = resolveEnabledToolKitKeys(toolkitsConfig, "user");
  const toolDefinitions = getEnabledToolDefinitions(toolkitsConfig, "user");
  const callOptions: ChatCallOptions = {};
  
  // 如果有注册的工具，就传递给模型
  if (toolDefinitions.length > 0) {
    callOptions.tools = toolDefinitions;
    callOptions.tool_choice = "auto";
  }

  // 工具调用循环（最多 5 轮）
  const MAX_TOOL_ROUNDS = 5;
  let currentMessages = [...messagesForAi];
  let finalContent = "";
  let toolRound = 0;

  while (toolRound < MAX_TOOL_ROUNDS) {
    const aiResult = await callChatByModelId(conv.model_id, currentMessages, callOptions);

    // 如果没有工具调用，直接返回
    if (!aiResult.tool_calls || aiResult.tool_calls.length === 0) {
      finalContent = aiResult.content;
      break;
    }

    // 有工具调用，执行工具
    toolRound++;

    // 添加 assistant 的工具调用消息
    currentMessages.push({
      role: "assistant",
      content: aiResult.content || null,
      tool_calls: aiResult.tool_calls,
    });

    // 执行每个工具并添加结果
    for (const toolCall of aiResult.tool_calls) {
      const toolName = toolCall.function.name;
      let toolArgs: Record<string, any> = {};
      
      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        toolArgs = {};
      }

      const toolResult = await executeTool(
        toolName,
        toolArgs,
        {
          userId: input.userId,
          conversationId: conv.id,
          conversationVars: varContext.conversationVars,
        },
        enabledToolKitKeys,
      );

      // 保存工具调用结果到数据库（用于前端渲染）
      createAiChatMessage({
        conversationId: conv.id,
        role: "tool",
        content: toolName,
        toolName: toolName,
        payload: {
          result: toolResult.result,
          pendingAction: toolResult.pendingAction,
          args: toolArgs,
          success: toolResult.success,
          error: toolResult.error,
        },
      });

      // 添加工具结果消息给模型
      currentMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult.success ? toolResult.result : { error: toolResult.error }),
      });

      // 更新会话变量
      if (toolResult.updatedVars) {
        Object.assign(varContext.conversationVars, toolResult.updatedVars);
      }
    }
  }

  // 如果工具调用超过最大轮数，进行最后一次调用（不带工具）
  if (toolRound >= MAX_TOOL_ROUNDS && !finalContent) {
    const finalResult = await callChatByModelId(conv.model_id, currentMessages, {});
    finalContent = finalResult.content;
  }

  const assistantMessage = createAiChatMessage({
    conversationId: conv.id,
    role: "assistant",
    content: finalContent,
    toolName: null,
    payload: {
      provider: "chat_model",
      modelKey: model.key,
      toolRounds: toolRound > 0 ? toolRound : undefined,
    },
  });

  // 自动会话命名（忽略命名过程中的错误，不影响主流程）
  try {
    await tryAutoNameConversation(conv.id);
  } catch {
    // 忽略命名错误
  }

  return { userMessage, assistantMessage };
};
