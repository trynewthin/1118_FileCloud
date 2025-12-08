import type { IncomingHttpHeaders } from "http";

export type ChatRole = "system" | "user" | "assistant" | "tool";

// 工具调用定义（OpenAI 风格）
export interface ChatToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;  // JSON Schema
  };
}

// 工具调用请求（模型返回）
export interface ChatToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;  // JSON 字符串
  };
}

// 单条对话消息输入结构
export interface ChatMessageInput {
  role: ChatRole;
  content: string | null;
  attachments?: ChatAttachment[];
  // 工具调用相关
  tool_calls?: ChatToolCall[];      // assistant 角色的工具调用
  tool_call_id?: string;            // tool 角色的响应
  name?: string;                    // tool 角色的函数名
}

export interface ChatAttachment {
  kind: "image";
  mimeType: string;
  dataBase64: string;
}

// 模型调用配置，由上层根据 provider / model 记录组装
export interface ChatModelConfig {
  baseUrl: string;
  apiKey?: string | null;
  apiType: string; // 例如 openai_compatible
  model: string;
  timeoutMs?: number | null;
  headers?: IncomingHttpHeaders;
}

export interface ChatCallOptions {
  temperature?: number;
  maxTokens?: number;
  tools?: ChatToolDefinition[];       // 可用工具列表
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
}

export interface ChatResult {
  content: string;
  tool_calls?: ChatToolCall[];        // 模型请求的工具调用
  finish_reason?: string;             // stop / tool_calls / length 等
  raw: any;
}

// 统一的聊天调用入口，目前仅实现 openai_compatible 风格，后续可扩展
export async function callChatModel(
  config: ChatModelConfig,
  messages: ChatMessageInput[],
  options: ChatCallOptions = {},
): Promise<ChatResult> {
  const apiType = config.apiType || "openai_compatible";

  if (apiType === "openai_compatible") {
    return callOpenAiCompatible(config, messages, options);
  }

  throw new Error(`不支持的 AI 接口类型: ${apiType}`);
}

// 构建 OpenAI 格式的消息
const buildOpenAiMessage = (m: ChatMessageInput): any => {
  // tool 角色的消息
  if (m.role === "tool") {
    return {
      role: "tool",
      tool_call_id: m.tool_call_id,
      content: m.content ?? "",
    };
  }

  // assistant 角色带工具调用
  if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
    return {
      role: "assistant",
      content: m.content,
      tool_calls: m.tool_calls,
    };
  }

  // 普通消息（可能带图片附件）
  if (!m.attachments || m.attachments.length === 0) {
    return { role: m.role, content: m.content };
  }

  const parts: any[] = [];

  if (m.content && m.content.trim().length > 0) {
    parts.push({ type: "text", text: m.content });
  }

  for (const att of m.attachments) {
    if (att.kind === "image" && att.dataBase64) {
      const mime = att.mimeType || "image/png";
      const dataUrl = `data:${mime};base64,${att.dataBase64}`;
      parts.push({ type: "image_url", image_url: { url: dataUrl } });
    }
  }

  if (parts.length === 0) {
    return { role: m.role, content: m.content };
  }

  return { role: m.role, content: parts };
};

async function callOpenAiCompatible(
  config: ChatModelConfig,
  messages: ChatMessageInput[],
  options: ChatCallOptions,
): Promise<ChatResult> {
  const url = new URL("/v1/chat/completions", config.baseUrl).toString();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  if (config.headers) {
    for (const [k, v] of Object.entries(config.headers)) {
      if (typeof v === "undefined") continue;
      headers[k] = Array.isArray(v) ? v.join(",") : String(v);
    }
  }

  const openAiMessages = messages.map(buildOpenAiMessage);

  const body: Record<string, any> = {
    model: config.model,
    messages: openAiMessages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
  };

  // 添加工具定义
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    if (options.tool_choice) {
      body.tool_choice = options.tool_choice;
    }
  }

  const controller = new AbortController();
  const timeoutMs = config.timeoutMs && config.timeoutMs > 0 ? config.timeoutMs : 60_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await safeReadText(resp);
      throw new Error(`调用 AI 接口失败: ${resp.status} ${resp.statusText} - ${text}`);
    }

    const json: any = await resp.json();
    let content: string = "";
    let tool_calls: ChatToolCall[] | undefined;
    let finish_reason: string | undefined;

    const choice = json?.choices?.[0];
    const message = choice?.message;
    finish_reason = choice?.finish_reason;

    // 解析内容（支持 reasoning_content 字段，用于推理模型）
    const messageContent = message?.content ?? choice?.delta?.content;
    const reasoningContent = message?.reasoning_content;
    
    if (typeof messageContent === "string") {
      content = messageContent;
    } else if (Array.isArray(messageContent)) {
      const textParts = messageContent
        .filter((p: any) => p && p.type === "text" && typeof p.text === "string")
        .map((p: any) => p.text);
      content = textParts.join("\n\n");
    } else if (typeof messageContent === "object" && messageContent !== null && typeof messageContent.text === "string") {
      content = messageContent.text;
    }
    
    // 如果 content 为空但有 reasoning_content，使用 reasoning_content
    // 注意：reasoning_content 通常包含推理过程，需要提取最终答案
    if (!content && typeof reasoningContent === "string" && reasoningContent.trim()) {
      content = reasoningContent;
    }

    // 解析工具调用
    if (message?.tool_calls && Array.isArray(message.tool_calls)) {
      tool_calls = message.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: tc.type || "function",
        function: {
          name: tc.function?.name ?? "",
          arguments: tc.function?.arguments ?? "{}",
        },
      }));
    }

    return {
      content,
      tool_calls,
      finish_reason,
      raw: json,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function safeReadText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}
