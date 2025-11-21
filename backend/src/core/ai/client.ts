import type { IncomingHttpHeaders } from "http";

export type ChatRole = "system" | "user" | "assistant";

// 单条对话消息输入结构
export interface ChatMessageInput {
  role: ChatRole;
  content: string;
  // 这里后续可扩展附件（图片、视频等）
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
}

export interface ChatResult {
  content: string;
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

  const body = {
    model: config.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
  };

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
    const content: string =
      json?.choices?.[0]?.message?.content ?? json?.choices?.[0]?.delta?.content ?? "";

    return {
      content,
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
