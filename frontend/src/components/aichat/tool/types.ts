export interface ToolCallResult {
  type: string;
  [key: string]: any;
}

export interface PendingAction {
  toolName: string;
  description: string;
  args: Record<string, any>;
}
