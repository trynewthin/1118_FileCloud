/**
 * 文件库工具包
 * 
 * 包含与文件库相关的所有工具：
 * - list_libraries: 列出文件库
 * - list_directory: 查看目录内容
 * - get_file_info: 获取文件详情
 * - search_files: 搜索文件
 * - show_files: 展示文件给用户
 * - rename_file: 重命名文件（需确认）
 * - move_file: 移动文件（需确认）
 * - delete_file: 删除文件（需确认）
 */

import type { ToolKit, ToolDefinition } from "./types.ts";
import { listEntriesByParent, getEntryById } from "../../files/service.ts";
import { searchByFts } from "../../files/ftsService.ts";
import { db } from "../../../core/db/index.ts";

// ============================================================================
// 辅助函数
// ============================================================================

/** 获取启用的文件库列表 */
const getFileLibraries = () => {
  const rows = db
    .prepare("SELECT id, display_name, root_path FROM file_libraries WHERE is_enabled = 1")
    .all() as { id: number; display_name: string; root_path: string }[];
  return rows;
};

// ============================================================================
// 工具定义
// ============================================================================

/** 列出文件库 */
const listLibrariesTool: ToolDefinition = {
  name: "list_libraries",
  callType: "view",
  definition: {
    type: "function",
    function: {
      name: "list_libraries",
      description: "获取所有可用的文件库列表。在搜索或浏览文件之前，可以先调用此工具查看有哪些文件库可用。",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  executor: async () => {
    const libraries = getFileLibraries();
    return {
      success: true,
      result: {
        type: "library_list",
        libraries: libraries.map((lib) => ({
          id: lib.id,
          name: lib.display_name,
        })),
        message: `共有 ${libraries.length} 个可用的文件库`,
      },
    };
  },
};

/** 查看目录内容 */
const listDirectoryTool: ToolDefinition = {
  name: "list_directory",
  callType: "view",
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
  executor: async (args) => {
    const libraryId = args.library_id;
    const parentId = args.parent_id;

    if (!libraryId) {
      const libraries = getFileLibraries();
      return {
        success: true,
        result: {
          type: "library_list",
          libraries: libraries.map((lib) => ({
            id: lib.id,
            name: lib.display_name,
          })),
          message: `共有 ${libraries.length} 个文件库`,
        },
      };
    }

    const entries = listEntriesByParent({ libraryId, parentId: parentId || null });

    return {
      success: true,
      result: {
        type: "directory_listing",
        libraryId,
        parentId: parentId || null,
        entries: entries.map((e) => ({
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
};

/** 获取文件详情 */
const getFileInfoTool: ToolDefinition = {
  name: "get_file_info",
  callType: "view",
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
  executor: async (args) => {
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
};

/** 搜索文件 */
const searchFilesTool: ToolDefinition = {
  name: "search_files",
  callType: "view",
  definition: {
    type: "function",
    function: {
      name: "search_files",
      description: "搜索文件或目录。支持跨文件库搜索，使用全文搜索引擎，支持中文分词和前缀匹配。支持一次传入多个搜索项并合并结果，并支持按文件类型筛选。",
      parameters: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description: "搜索关键词，支持中文和英文，会匹配文件名和路径",
          },
          keywords: {
            type: "array",
            items: { type: "string" },
            description: "多个搜索关键词（可选）。若同时提供 keyword 与 keywords，将合并去重后一起搜索。",
          },
          library_id: {
            type: "number",
            description: "文件库 ID（可选）。如果不指定，将在所有文件库中搜索。",
          },
          type: {
            type: "string",
            enum: ["all", "file", "directory"],
            description: "搜索类型：all（全部）、file（仅文件）、directory（仅目录）。默认为 all",
          },
          extension: {
            type: "string",
            description: "按扩展名过滤（可选），例如 'mp4'、'jpg'、'pdf'",
          },
          file_type: {
            type: "string",
            enum: [
              "image",
              "video",
              "audio",
              "document",
              "archive",
              "code",
              "text",
              "subtitle",
              "ebook",
            ],
            description: "按文件类型过滤（可选）。仅对文件生效；如果 type=directory 将忽略该过滤。",
          },
          limit: {
            type: "number",
            description: "返回结果数量上限（可选）。单库默认 30，跨库总量默认最多 50。",
          },
        },
      },
    },
  },
  executor: async (args) => {
    const keyword = args.keyword;
    const keywords = args.keywords;
    const libraryId = args.library_id;
    const type = args.type || "all";
    const extension = args.extension;
    const fileType = args.file_type;

    const limitRaw = args.limit;
    const limit =
      Number.isFinite(Number(limitRaw)) && Number(limitRaw) > 0
        ? Math.max(1, Math.min(100, Math.floor(Number(limitRaw))))
        : 30;

    const FILE_TYPE_TO_EXTENSIONS: Record<string, string[]> = {
      image: ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "tiff"],
      video: ["mp4", "mkv", "mov", "avi", "webm", "flv", "m4v"],
      audio: ["mp3", "wav", "flac", "aac", "m4a", "ogg", "opus"],
      document: ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"],
      archive: ["zip", "rar", "7z", "tar", "gz", "bz2"],
      code: ["js", "ts", "tsx", "jsx", "py", "java", "go", "rs", "c", "cpp", "h", "hpp", "cs", "php", "rb", "sh"],
      text: ["txt", "md", "log", "json", "yaml", "yml", "xml", "ini", "csv"],
      subtitle: ["srt", "ass", "ssa", "vtt"],
      ebook: ["epub", "mobi", "azw3"],
    };

    // 合并搜索词
    const normalizedTerms = (() => {
      const out: string[] = [];
      if (typeof keyword === "string" && keyword.trim()) {
        out.push(keyword.trim());
      }
      if (Array.isArray(keywords)) {
        for (const k of keywords) {
          if (typeof k !== "string") continue;
          const trimmed = k.trim();
          if (!trimmed) continue;
          out.push(trimmed);
        }
      }
      return Array.from(new Set(out));
    })();

    if (normalizedTerms.length === 0) {
      return { success: false, error: "请提供搜索关键词（keyword 或 keywords）" };
    }

    const effectiveTerms = normalizedTerms.slice(0, 5);

    // 扩展名过滤
    const extensionsFromFileType = (() => {
      if (type === "directory") return [];
      if (!fileType || typeof fileType !== "string") return [];
      return FILE_TYPE_TO_EXTENSIONS[fileType] ?? [];
    })();

    const extensionsFilter = (() => {
      if (type === "directory") return [];
      if (typeof extension === "string" && extension.trim()) {
        return [extension.trim().toLowerCase()];
      }
      if (extensionsFromFileType.length > 0) {
        return extensionsFromFileType.map((e) => e.toLowerCase());
      }
      return [];
    })();

    // 构建消息
    const buildMessage = (scopeLabel: string, totalBeforeLimit: number, totalAfterLimit: number) => {
      const termLabel =
        effectiveTerms.length === 1
          ? `"${effectiveTerms[0]}"`
          : `(${effectiveTerms.map((t) => `"${t}"`).join(" 或 ")})`;

      const limitSuffix =
        totalBeforeLimit > totalAfterLimit ? `（仅显示前 ${totalAfterLimit} 个）` : "";

      const fileTypeLabel =
        typeof fileType === "string" && fileType.trim() ? `，文件类型=${fileType.trim()}` : "";

      const extLabel =
        extensionsFilter.length === 1
          ? `，扩展名=${extensionsFilter[0]}`
          : extensionsFilter.length > 1
            ? `，扩展名=${extensionsFilter.length} 种`
            : "";

      return `${scopeLabel}搜索 ${termLabel}${fileTypeLabel}${extLabel} 找到 ${totalBeforeLimit} 个结果${limitSuffix}`;
    };

    // 单库搜索
    if (libraryId) {
      const merged: Array<{
        id: string;
        name: string;
        path: string;
        isDirectory: boolean;
        size: number;
        extension: string | null;
        rank?: number;
      }> = [];

      const dedup = new Map<string, (typeof merged)[number]>();

      for (const term of effectiveTerms) {
        const results = searchByFts({
          libraryId,
          keyword: term,
          type: type as "all" | "file" | "directory",
          extension: extensionsFilter.length === 1 ? extensionsFilter[0] : undefined,
          extensions: extensionsFilter.length > 1 ? extensionsFilter : undefined,
          limit: Math.max(limit, 30),
        });

        for (const r of results) {
          if (!dedup.has(r.id)) {
            dedup.set(r.id, r);
          }
        }
      }

      merged.push(...dedup.values());

      merged.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        const ar = typeof a.rank === "number" ? a.rank : 0;
        const br = typeof b.rank === "number" ? b.rank : 0;
        if (ar !== br) return ar - br;
        return String(a.name).localeCompare(String(b.name), "zh-CN");
      });

      const limited = merged.slice(0, limit);

      return {
        success: true,
        result: {
          type: "search_results",
          libraryId,
          keyword: effectiveTerms.join(" | "),
          searchType: type,
          results: limited.map((r) => ({
            id: r.id,
            name: r.name,
            path: r.path,
            isDirectory: r.isDirectory,
            size: r.size,
            extension: r.extension,
          })),
          message: buildMessage(`在文件库 ${libraryId} 中`, merged.length, limited.length),
        },
      };
    }

    // 跨库搜索
    const libraries = getFileLibraries();
    const allResults: Array<{
      id: string;
      name: string;
      path: string;
      isDirectory: boolean;
      size: number;
      extension: string | null;
      rank?: number;
      libraryId: number;
      libraryName: string;
    }> = [];

    const dedup = new Map<string, (typeof allResults)[number]>();

    for (const lib of libraries) {
      for (const term of effectiveTerms) {
        const results = searchByFts({
          libraryId: lib.id,
          keyword: term,
          type: type as "all" | "file" | "directory",
          extension: extensionsFilter.length === 1 ? extensionsFilter[0] : undefined,
          extensions: extensionsFilter.length > 1 ? extensionsFilter : undefined,
          limit: 30,
        });

        for (const r of results) {
          const key = `${lib.id}:${r.id}`;
          if (!dedup.has(key)) {
            dedup.set(key, {
              id: r.id,
              name: r.name,
              path: r.path,
              isDirectory: r.isDirectory,
              size: r.size,
              extension: r.extension,
              rank: r.rank,
              libraryId: lib.id,
              libraryName: lib.display_name,
            });
          }
        }
      }
    }

    allResults.push(...dedup.values());

    allResults.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      const ar = typeof a.rank === "number" ? a.rank : 0;
      const br = typeof b.rank === "number" ? b.rank : 0;
      if (ar !== br) return ar - br;
      return String(a.name).localeCompare(String(b.name), "zh-CN");
    });

    const crossLibraryLimit = Math.max(1, Math.min(50, limit));
    const limitedResults = allResults.slice(0, crossLibraryLimit);

    return {
      success: true,
      result: {
        type: "search_results",
        keyword: effectiveTerms.join(" | "),
        searchType: type,
        searchScope: "all_libraries",
        results: limitedResults,
        message: buildMessage("在所有文件库中", allResults.length, limitedResults.length),
      },
    };
  },
};

/** 展示文件给用户 */
const showFilesTool: ToolDefinition = {
  name: "show_files",
  callType: "view",
  definition: {
    type: "function",
    function: {
      name: "show_files",
      description: "向用户展示一个或多个文件/文件夹，用户可以点击跳转查看。当搜索到文件或需要向用户推荐文件时使用此工具。",
      parameters: {
        type: "object",
        properties: {
          file_ids: {
            type: "array",
            items: { type: "string" },
            description: "要展示的文件或文件夹 ID 列表",
          },
          title: {
            type: "string",
            description: "展示标题（可选），例如 '搜索结果'、'推荐文件' 等",
          },
        },
        required: ["file_ids"],
      },
    },
  },
  executor: async (args) => {
    const fileIds = args.file_ids as string[];
    const title = args.title as string | undefined;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return { success: false, error: "请提供至少一个文件 ID" };
    }

    const files: Array<{
      id: string;
      name: string;
      isDirectory: boolean;
      size: number;
      extension: string | null;
      mimeType: string | null;
      libraryId: number;
    }> = [];

    for (const fileId of fileIds) {
      const entry = getEntryById(fileId);
      if (entry) {
        files.push({
          id: entry.id,
          name: entry.original_name,
          isDirectory: entry.is_directory,
          size: entry.size_bytes,
          extension: entry.extension,
          mimeType: entry.mime_type,
          libraryId: entry.library_id,
        });
      }
    }

    if (files.length === 0) {
      return { success: false, error: "未找到任何有效的文件" };
    }

    return {
      success: true,
      result: {
        type: "file_display",
        title: title || "文件",
        files,
        message: `展示 ${files.length} 个文件`,
      },
    };
  },
};

/** 重命名文件（需确认） */
const renameFileTool: ToolDefinition = {
  name: "rename_file",
  callType: "modify",
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
  executor: async (args) => {
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
};

/** 移动文件（需确认） */
const moveFileTool: ToolDefinition = {
  name: "move_file",
  callType: "modify",
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
  executor: async (args) => {
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
};

/** 删除文件（需确认） */
const deleteFileTool: ToolDefinition = {
  name: "delete_file",
  callType: "modify",
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
  executor: async (args) => {
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
};

// ============================================================================
// 导出工具包
// ============================================================================

export const fileLibraryToolKit: ToolKit = {
  meta: {
    key: "file_library",
    displayName: "文件库",
    description: "文件浏览、搜索、管理等功能",
    icon: "FolderOpen",
    defaultEnabled: true,
    order: 10,
  },
  tools: [
    listLibrariesTool,
    listDirectoryTool,
    getFileInfoTool,
    searchFilesTool,
    showFilesTool,
    renameFileTool,
    moveFileTool,
    deleteFileTool,
  ],
};
