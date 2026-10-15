interface ToolFileEntry {
  id: string;
  name: string;
  isDirectory: boolean;
  size: number;
  extension: string | null;
}

export interface ToolCallResult {
  type: string;
  message?: string;
  title?: string;
  action?: string;
  contentUrl?: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
  date?: string;
  time?: string;
  entries?: ToolFileEntry[];
  files?: Array<ToolFileEntry & { mimeType: string | null; libraryId: number }>;
  file?: ToolFileEntry & { mimeType: string | null; createdAt: string; updatedAt: string };
  libraries?: Array<{ id: number; name: string }>;
  results?: Array<ToolFileEntry & { path: string }>;
  [key: string]: unknown;
}

export interface PendingAction {
  toolName: string;
  description: string;
  args: Record<string, unknown>;
}
