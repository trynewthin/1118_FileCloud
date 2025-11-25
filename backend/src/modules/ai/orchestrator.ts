import type { AiChatConversation, AiChatMessage } from "./service.ts";
import type { AiVariableContext, AiToolDefinition } from "./tools.ts";
import { BUILTIN_AI_TOOLS } from "./tools.ts";

export interface AiProposedAction {
  type: string;
  targetVarKey?: string;
  params?: any;
  status?: "pending" | "confirmed" | "rejected" | "executed";
}

export interface RunPreToolOptions {
  toolKey: string;
  context: AiVariableContext;
  conversation: AiChatConversation;
  userId: number;
  messageContent?: string | null;
}

export interface RunPreToolResult {
  context: AiVariableContext;
  logs: string[];
}

export interface RunPostToolOptions {
  toolKey: string;
  action: AiProposedAction;
  context: AiVariableContext;
  conversation: AiChatConversation;
  message: AiChatMessage;
  userId: number;
}

export interface RunPostToolResult {
  context: AiVariableContext;
  action: AiProposedAction;
  logs: string[];
}

const buildVarsFromRaw = (raw: any): AiVariableContext["conversationVars"] => {
  const result: AiVariableContext["conversationVars"] = {};

  if (!raw || typeof raw !== "object") return result;

  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    const v: any = value;
    if (typeof v.kind !== "string") continue;
    result[key] = { kind: v.kind, value: v.value };
  }

  return result;
};

const isVarsEmpty = (vars: AiVariableContext["conversationVars"]): boolean => {
  for (const key in vars) {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return false;
    }
  }
  return true;
};

export const buildVariableContext = (
  conversation: AiChatConversation,
  message?: AiChatMessage | null,
): AiVariableContext => {
  const convRawVars = (conversation.metadata as any)?.ai_vars;
  const msgRawVars = (message?.payload as any)?.ai_vars;

  return {
    conversationVars: buildVarsFromRaw(convRawVars),
    messageVars: buildVarsFromRaw(msgRawVars),
  };
};

export const applyVariableContext = (
  conversation: AiChatConversation,
  message: AiChatMessage | null,
  context: AiVariableContext,
): { conversationMetadata: any; messagePayload: any } => {
  const baseMetadata =
    conversation.metadata && typeof conversation.metadata === "object"
      ? { ...(conversation.metadata as any) }
      : {};

  const basePayload =
    message && message.payload && typeof message.payload === "object"
      ? { ...(message.payload as any) }
      : {};

  if (isVarsEmpty(context.conversationVars)) {
    delete (baseMetadata as any).ai_vars;
  } else {
    (baseMetadata as any).ai_vars = context.conversationVars;
  }

  if (isVarsEmpty(context.messageVars)) {
    delete (basePayload as any).ai_vars;
  } else {
    (basePayload as any).ai_vars = context.messageVars;
  }

  return {
    conversationMetadata: baseMetadata,
    messagePayload: basePayload,
  };
};

export const findBuiltinTool = (toolKey: string): AiToolDefinition | undefined => {
  return BUILTIN_AI_TOOLS.find((t) => t.key === toolKey);
};

export const runPreTool = async (options: RunPreToolOptions): Promise<RunPreToolResult> => {
  const logs: string[] = [];
  const tool = findBuiltinTool(options.toolKey);

  if (!tool) {
    logs.push(`工具未注册: ${options.toolKey}`);
    return { context: options.context, logs };
  }

  if (tool.type !== "pre") {
    logs.push(`工具类型不匹配，期望 pre 实际为 ${tool.type}`);
    return { context: options.context, logs };
  }
  if (tool.requiredVars && tool.requiredVars.length > 0) {
    let missingOrInvalid = false;

    for (const spec of tool.requiredVars) {
      const vars = spec.scope === "conversation"
        ? options.context.conversationVars
        : options.context.messageVars;

      const actual = vars[spec.key];
      if (!actual) {
        logs.push(`缺少必需变量: ${spec.scope}.${spec.key}`);
        missingOrInvalid = true;
        continue;
      }

      if (actual.kind !== spec.kind) {
        logs.push(`变量类型不匹配: ${spec.scope}.${spec.key} 期望 ${spec.kind} 实际 ${actual.kind}`);
        missingOrInvalid = true;
      }
    }

    if (missingOrInvalid) {
      logs.push("前置工具前置条件未满足，未执行具体逻辑");
      return { context: options.context, logs };
    }
  }

  logs.push("前置工具执行入口未实现，仅完成校验");
  return { context: options.context, logs };
};

export const runPostTool = async (options: RunPostToolOptions): Promise<RunPostToolResult> => {
  const logs: string[] = [];
  const tool = findBuiltinTool(options.toolKey);

  if (!tool) {
    logs.push(`工具未注册: ${options.toolKey}`);
    return { context: options.context, action: options.action, logs };
  }

  if (tool.type !== "post") {
    logs.push(`工具类型不匹配，期望 post 实际为 ${tool.type}`);
    return { context: options.context, action: options.action, logs };
  }
  if (tool.requiredVars && tool.requiredVars.length > 0) {
    let missingOrInvalid = false;

    for (const spec of tool.requiredVars) {
      const vars = spec.scope === "conversation"
        ? options.context.conversationVars
        : options.context.messageVars;

      const actual = vars[spec.key];
      if (!actual) {
        logs.push(`缺少必需变量: ${spec.scope}.${spec.key}`);
        missingOrInvalid = true;
        continue;
      }

      if (actual.kind !== spec.kind) {
        logs.push(`变量类型不匹配: ${spec.scope}.${spec.key} 期望 ${spec.kind} 实际 ${actual.kind}`);
        missingOrInvalid = true;
      }
    }

    if (missingOrInvalid) {
      logs.push("后置工具前置条件未满足，未执行具体逻辑");
      return { context: options.context, action: options.action, logs };
    }
  }

  logs.push("后置工具执行入口未实现，仅完成校验");
  return { context: options.context, action: options.action, logs };
};
