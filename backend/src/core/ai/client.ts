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
    /**
     * 部分上游（如某些网关/供应商）要求工具调用携带 thought_signature
     * 该字段通常由模型返回，后续轮次需要原样回传以保证工具链正确。
     */
    thought_signature?: string;
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
  /** 是否启用流式输出 */
  stream?: boolean;
  /** 流式输出时的增量回调 */
  onDelta?: (delta: string) => void;
  /** 流式输出时检测到工具调用（工具名出现） */
  onToolCall?: (toolName: string, toolIndex: number) => void;
  /** 外部 AbortSignal（用于取消请求） */
  signal?: AbortSignal;
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
      tool_calls: m.tool_calls.map((tc) => {
        const fn: Record<string, any> = {
          name: tc.function.name,
          arguments: tc.function.arguments,
        };
        // 部分上游要求 thought_signature 必须回传
        if (tc.function.thought_signature) {
          fn.thought_signature = tc.function.thought_signature;
        }
        return {
          id: tc.id,
          type: tc.type,
          function: fn,
        };
      }),
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
    stream: options.stream ?? false,
  };

  // 添加工具定义
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    if (options.tool_choice) {
      body.tool_choice = options.tool_choice;
    }
  }

  const controller = new AbortController();
  const timeoutMs = config.timeoutMs && config.timeoutMs > 0 ? config.timeoutMs : 120_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // 如果外部传入 signal，监听其 abort 事件
  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

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

    // 流式模式
    if (options.stream && resp.body) {
      return await handleStreamResponse(resp, options.onDelta, options.onToolCall);
    }

    // 非流式模式
    return await handleNonStreamResponse(resp);
  } finally {
    clearTimeout(timer);
  }
}

/** 处理非流式响应 */
async function handleNonStreamResponse(resp: Response): Promise<ChatResult> {
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
        thought_signature:
          tc.function?.thought_signature ??
          tc.function?.thoughtSignature ??
          tc.thought_signature ??
          tc.thoughtSignature,
      },
    }));
  }

  return {
    content,
    tool_calls,
    finish_reason,
    raw: json,
  };
}

/** 处理流式响应 */
async function handleStreamResponse(
  resp: Response,
  onDelta?: (delta: string) => void,
  onToolCall?: (toolName: string, toolIndex: number) => void,
): Promise<ChatResult> {
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder("utf-8");

  let content = "";
  let tool_calls: ChatToolCall[] | undefined;
  let finish_reason: string | undefined;
  let buffer = "";

  // 用于累积工具调用（流式模式下工具调用可能分多个 chunk）
  const toolCallsMap = new Map<number, { id: string; type: string; name: string; arguments: string; thought_signature?: string }>();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 按行解析 SSE
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;

        const jsonStr = trimmed.slice(6);
        try {
          const chunk = JSON.parse(jsonStr);
          const delta = chunk?.choices?.[0]?.delta;
          const chunkFinishReason = chunk?.choices?.[0]?.finish_reason;

          if (chunkFinishReason) {
            finish_reason = chunkFinishReason;
          }

          // 累积文本内容
          if (delta?.content) {
            content += delta.content;
            if (onDelta) {
              onDelta(delta.content);
            }
          }

          // 累积工具调用
          if (delta?.tool_calls && Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              const existing = toolCallsMap.get(idx);
              if (existing) {
                // 追加 arguments
                if (tc.function?.arguments) {
                  existing.arguments += tc.function.arguments;
                }

                // 补齐 name（部分流式返回会先给 arguments 再给 name）
                if (!existing.name && tc.function?.name) {
                  existing.name = tc.function.name;
                  onToolCall?.(existing.name, idx);
                }

                // 首次出现时保存 thought_signature
                const ts =
                  tc.function?.thought_signature ??
                  tc.function?.thoughtSignature ??
                  tc.thought_signature ??
                  tc.thoughtSignature;
                if (!existing.thought_signature && ts) {
                  existing.thought_signature = ts;
                }
              } else {
                toolCallsMap.set(idx, {
                  id: tc.id || "",
                  type: tc.type || "function",
                  name: tc.function?.name || "",
                  arguments: tc.function?.arguments || "",
                  thought_signature:
                    tc.function?.thought_signature ??
                    tc.function?.thoughtSignature ??
                    tc.thought_signature ??
                    tc.thoughtSignature,
                });

                const toolName = tc.function?.name;
                if (toolName) {
                  onToolCall?.(toolName, idx);
                }
              }
            }
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // 转换工具调用
  if (toolCallsMap.size > 0) {
    tool_calls = Array.from(toolCallsMap.values()).map((tc) => ({
      id: tc.id,
      type: "function" as const,
      function: {
        name: tc.name,
        arguments: tc.arguments,
        thought_signature: tc.thought_signature,
      },
    }));
  }

  return {
    content,
    tool_calls,
    finish_reason,
    raw: null,
  };
}

async function safeReadText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}
