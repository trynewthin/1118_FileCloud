import type { ChatToolDefinition } from "../../core/ai/client.ts";
import { listEntriesByParent, getEntryById, searchEntries } from "../files/service.ts";
import { db } from "../../core/db/index.ts";

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

// 工具执行器类型
export type ToolExecutor = (args: Record<string, any>, context: ToolExecutionContext) => Promise<ToolExecutionResult>;

export interface ToolExecutionContext {
  userId: number;
  conversationId: number;
  conversationVars: AiVariableCollection;
}

// 工具调用类型：查看类不需要确认，修改类需要确认
export type ToolCallType = "view" | "modify";

export interface ToolExecutionResult {
  success: boolean;
  result?: any;           // 返回给模型的结果
  error?: string;         // 错误信息
  updatedVars?: AiVariableCollection;  // 更新的会话变量
  // 新增：需要用户确认的操作
  pendingAction?: {
    toolName: string;
    description: string;
    args: Record<string, any>;
  };
}

// 工具注册表
export interface RegisteredTool {
  definition: ChatToolDefinition;  // OpenAI 格式的工具定义
  executor: ToolExecutor;          // 工具执行器
}

const toolRegistry: Map<string, RegisteredTool> = new Map();

// 注册工具
export const registerTool = (name: string, tool: RegisteredTool): void => {
  toolRegistry.set(name, tool);
};

// 获取工具
export const getTool = (name: string): RegisteredTool | undefined => {
  return toolRegistry.get(name);
};

// 获取所有工具定义（用于传递给模型）
export const getAllToolDefinitions = (): ChatToolDefinition[] => {
  return Array.from(toolRegistry.values()).map(t => t.definition);
};

// 执行工具
export const executeTool = async (
  name: string,
  args: Record<string, any>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> => {
  const tool = toolRegistry.get(name);
  if (!tool) {
    return { success: false, error: `未知工具: ${name}` };
  }

  try {
    return await tool.executor(args, context);
  } catch (err: any) {
    return { success: false, error: err?.message || "工具执行失败" };
  }
};

// ============================================================================
// 内置工具定义（用于 orchestrator 兼容）
// ============================================================================

export const BUILTIN_AI_TOOLS: AiToolDefinition[] = [
  { key: "list_directory", type: "post" },
  { key: "get_file_info", type: "post" },
  { key: "search_files", type: "post" },
  { key: "rename_file", type: "post" },
  { key: "move_file", type: "post" },
  { key: "delete_file", type: "post" },
  { key: "get_current_time", type: "post" },
];

// ============================================================================
// 辅助函数
// ============================================================================

// 获取文件库列表
const getFileLibraries = () => {
  const rows = db
    .prepare("SELECT id, display_name, root_path FROM file_libraries WHERE is_enabled = 1")
    .all() as { id: number; display_name: string; root_path: string }[];
  return rows;
};

// ============================================================================
// 注册内置工具
// ============================================================================

// 1. 查看目录内容（不需要确认）
registerTool("list_directory", {
  definition: {
    type: "function",
    function: {
      name: "list_directory",
      description: "查看指定目录下的文件和文件夹列表。可以查看文件库根目录或指定文件夹的内容。",
      parameters: {
        type: "object",
        properties: {
          library_id: {
            type: "number",
            description: "文件库 ID。如果不指定，将列出所有可用的文件库。",
          },
          parent_id: {
            type: "string",
            description: "父目录 ID。如果不指定，将列出文件库根目录的内容。",
          },
        },
      },
    },
  },
  executor: async (args, _context) => {
    const libraryId = args.library_id;
    const parentId = args.parent_id;

    // 如果没有指定文件库，返回文件库列表
    if (!libraryId) {
      const libraries = getFileLibraries();
      return {
        success: true,
        result: {
          type: "library_list",
          libraries: libraries.map(lib => ({
            id: lib.id,
            name: lib.display_name,
          })),
          message: `共有 ${libraries.length} 个文件库`,
        },
      };
    }

    // 列出目录内容
    const entries = listEntriesByParent({ libraryId, parentId: parentId || null });
    
    return {
      success: true,
      result: {
        type: "directory_listing",
        libraryId,
        parentId: parentId || null,
        entries: entries.map(e => ({
          id: e.id,
          name: e.original_name,
          isDirectory: e.is_directory,
          size: e.size_bytes,
          extension: e.extension,
        })),
        message: `目录下共有 ${entries.length} 个项目`,
      },
    };
  },
});

// 2. 查看文件详情（不需要确认）
registerTool("get_file_info", {
  definition: {
    type: "function",
    function: {
      name: "get_file_info",
      description: "获取指定文件或文件夹的详细信息。",
      parameters: {
        type: "object",
        properties: {
          file_id: {
            type: "string",
            description: "文件或文件夹的 ID",
          },
        },
        required: ["file_id"],
      },
    },
  },
  executor: async (args, _context) => {
    const fileId = args.file_id;
    if (!fileId) {
      return { success: false, error: "请提供文件 ID" };
    }

    const entry = getEntryById(fileId);
    if (!entry) {
      return { success: false, error: "文件不存在" };
    }

    return {
      success: true,
      result: {
        type: "file_info",
        file: {
          id: entry.id,
          name: entry.original_name,
          isDirectory: entry.is_directory,
          size: entry.size_bytes,
          extension: entry.extension,
          mimeType: entry.mime_type,
          createdAt: entry.created_at,
          updatedAt: entry.updated_at,
        },
      },
    };
  },
});

// 3. 搜索文件和目录（不需要确认）
registerTool("search_files", {
  definition: {
    type: "function",
    function: {
      name: "search_files",
      description: "在指定文件库中搜索文件或目录。根据关键词匹配文件名。",
      parameters: {
        type: "object",
        properties: {
          library_id: {
            type: "number",
            description: "文件库 ID",
          },
          keyword: {
            type: "string",
            description: "搜索关键词，将匹配文件名中包含该关键词的文件或目录",
          },
          type: {
            type: "string",
            enum: ["all", "file", "directory"],
            description: "搜索类型：all（全部）、file（仅文件）、directory（仅目录）。默认为 all",
          },
        },
        required: ["library_id", "keyword"],
      },
    },
  },
  executor: async (args, _context) => {
    const libraryId = args.library_id;
    const keyword = args.keyword;
    const type = args.type || "all";

    if (!libraryId) {
      return { success: false, error: "请提供文件库 ID" };
    }
    if (!keyword || typeof keyword !== "string" || !keyword.trim()) {
      return { success: false, error: "请提供搜索关键词" };
    }

    const results = searchEntries({
      libraryId,
      keyword,
      type: type as "all" | "file" | "directory",
      limit: 30,
    });

    return {
      success: true,
      result: {
        type: "search_results",
        libraryId,
        keyword,
        searchType: type,
        results: results.map(r => ({
          id: r.id,
          name: r.name,
          path: r.path,
          isDirectory: r.isDirectory,
          size: r.size,
          extension: r.extension,
        })),
        message: `搜索 "${keyword}" 找到 ${results.length} 个结果`,
      },
    };
  },
});

// 4. 重命名文件（需要确认）
registerTool("rename_file", {
  definition: {
    type: "function",
    function: {
      name: "rename_file",
      description: "重命名指定的文件或文件夹。此操作需要用户确认后才会执行。",
      parameters: {
        type: "object",
        properties: {
          file_id: {
            type: "string",
            description: "要重命名的文件或文件夹 ID",
          },
          new_name: {
            type: "string",
            description: "新的名称（不包含扩展名，扩展名会自动保留）",
          },
        },
        required: ["file_id", "new_name"],
      },
    },
  },
  executor: async (args, _context) => {
    const fileId = args.file_id;
    const newName = args.new_name;

    if (!fileId) {
      return { success: false, error: "请提供文件 ID" };
    }
    if (!newName || typeof newName !== "string" || !newName.trim()) {
      return { success: false, error: "新名称不能为空" };
    }

    const entry = getEntryById(fileId);
    if (!entry) {
      return { success: false, error: "文件不存在" };
    }

    // 返回待确认的操作
    return {
      success: true,
      result: {
        type: "pending_action",
        action: "rename",
        message: `将 "${entry.original_name}" 重命名为 "${newName.trim()}${entry.extension || ""}"`,
      },
      pendingAction: {
        toolName: "rename_file",
        description: `将 "${entry.original_name}" 重命名为 "${newName.trim()}${entry.extension || ""}"`,
        args: {
          file_id: fileId,
          new_name: newName.trim(),
          original_name: entry.original_name,
        },
      },
    };
  },
});

// 4. 移动文件（需要确认）
registerTool("move_file", {
  definition: {
    type: "function",
    function: {
      name: "move_file",
      description: "将文件或文件夹移动到另一个目录。此操作需要用户确认后才会执行。",
      parameters: {
        type: "object",
        properties: {
          file_id: {
            type: "string",
            description: "要移动的文件或文件夹 ID",
          },
          target_parent_id: {
            type: "string",
            description: "目标父目录 ID。如果为空或 null，则移动到文件库根目录。",
          },
        },
        required: ["file_id"],
      },
    },
  },
  executor: async (args, _context) => {
    const fileId = args.file_id;
    const targetParentId = args.target_parent_id || null;

    if (!fileId) {
      return { success: false, error: "请提供文件 ID" };
    }

    const entry = getEntryById(fileId);
    if (!entry) {
      return { success: false, error: "文件不存在" };
    }

    let targetName = "根目录";
    if (targetParentId) {
      const targetEntry = getEntryById(targetParentId);
      if (!targetEntry) {
        return { success: false, error: "目标目录不存在" };
      }
      if (!targetEntry.is_directory) {
        return { success: false, error: "目标必须是一个目录" };
      }
      targetName = targetEntry.original_name;
    }

    return {
      success: true,
      result: {
        type: "pending_action",
        action: "move",
        message: `将 "${entry.original_name}" 移动到 "${targetName}"`,
      },
      pendingAction: {
        toolName: "move_file",
        description: `将 "${entry.original_name}" 移动到 "${targetName}"`,
        args: {
          file_id: fileId,
          target_parent_id: targetParentId,
          file_name: entry.original_name,
          target_name: targetName,
        },
      },
    };
  },
});

// 5. 删除文件（需要确认）
registerTool("delete_file", {
  definition: {
    type: "function",
    function: {
      name: "delete_file",
      description: "删除指定的文件或文件夹（移动到回收站）。此操作需要用户确认后才会执行。",
      parameters: {
        type: "object",
        properties: {
          file_id: {
            type: "string",
            description: "要删除的文件或文件夹 ID",
          },
        },
        required: ["file_id"],
      },
    },
  },
  executor: async (args, _context) => {
    const fileId = args.file_id;

    if (!fileId) {
      return { success: false, error: "请提供文件 ID" };
    }

    const entry = getEntryById(fileId);
    if (!entry) {
      return { success: false, error: "文件不存在" };
    }

    const itemType = entry.is_directory ? "文件夹" : "文件";

    return {
      success: true,
      result: {
        type: "pending_action",
        action: "delete",
        message: `将${itemType} "${entry.original_name}" 移动到回收站`,
      },
      pendingAction: {
        toolName: "delete_file",
        description: `将${itemType} "${entry.original_name}" 移动到回收站`,
        args: {
          file_id: fileId,
          file_name: entry.original_name,
          is_directory: entry.is_directory,
        },
      },
    };
  },
});

// 6. 获取当前时间（不需要确认）
registerTool("get_current_time", {
  definition: {
    type: "function",
    function: {
      name: "get_current_time",
      description: "获取当前的日期和时间",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  executor: async () => {
    const now = new Date();
    return {
      success: true,
      result: {
        type: "time_info",
        datetime: now.toISOString(),
        date: now.toLocaleDateString("zh-CN"),
        time: now.toLocaleTimeString("zh-CN"),
        timestamp: now.getTime(),
      },
    };
  },
});
