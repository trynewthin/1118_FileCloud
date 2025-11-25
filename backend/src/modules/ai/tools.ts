export type AiToolType = "pre" | "post";

export type AiVariableScope = "conversation" | "message";

export interface AiVariableValue {
  kind: string;
  value: any;
}

export interface AiVariableCollection {
  [key: string]: AiVariableValue | undefined;
}

export interface AiVariableContext {
  conversationVars: AiVariableCollection;
  messageVars: AiVariableCollection;
}

export interface AiToolVariableSpec {
  key: string;
  scope: AiVariableScope;
  kind: string;
}

export interface AiToolDefinition {
  key: string;
  type: AiToolType;
  requiredVars?: AiToolVariableSpec[];
  producedVars?: AiToolVariableSpec[];
}

export const BUILTIN_AI_TOOLS: AiToolDefinition[] = [
  {
    key: "select_file",
    type: "pre",
    producedVars: [
      {
        key: "selectedFile",
        scope: "conversation",
        kind: "file_entry",
      },
    ],
  },
  {
    key: "extract_video_frames",
    type: "pre",
    requiredVars: [
      {
        key: "selectedFile",
        scope: "conversation",
        kind: "file_entry",
      },
    ],
    producedVars: [
      {
        key: "videoFrames",
        scope: "conversation",
        kind: "image_upload_list",
      },
    ],
  },
  {
    key: "rename_file",
    type: "post",
    requiredVars: [
      {
        key: "selectedFile",
        scope: "conversation",
        kind: "file_entry",
      },
    ],
  },
  {
    key: "finish_topic",
    type: "post",
  },
];
