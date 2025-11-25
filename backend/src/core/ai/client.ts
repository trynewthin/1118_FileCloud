import type { IncomingHttpHeaders } from "http";

export type ChatRole = "system" | "user" | "assistant";

// 单条对话消息输入结构
export interface ChatMessageInput {
  role: ChatRole;
  content: string;
  attachments?: ChatAttachment[];
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

  const openAiMessages = messages.map((m) => {
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
        const url = `data:${mime};base64,${att.dataBase64}`;
        parts.push({ type: "image_url", image_url: { url } });
      }
    }

    if (parts.length === 0) {
      return { role: m.role, content: m.content };
    }

    return { role: m.role, content: parts };
  });

  const body = {
    model: config.model,
    messages: openAiMessages,
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
    let content: string = "";

    const messageContent = json?.choices?.[0]?.message?.content ?? json?.choices?.[0]?.delta?.content;

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
