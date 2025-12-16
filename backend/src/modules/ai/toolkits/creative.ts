/**
 * 创意工具包
 * 
 * 包含创意相关的工具：
 * - create_markdown_file: 创建 Markdown 文件
 * - create_html_file: 创建 HTML 文件
 */

import type { ToolKit, ToolDefinition, ToolExecutionContext } from "./types.ts";
import { createGeneratedFile } from "../conversationFiles/service.ts";

// ============================================================================
// 工具定义
// ============================================================================

/** 创建 Markdown 文件 */
const createMarkdownFileTool: ToolDefinition = {
  name: "create_markdown_file",
  callType: "view",
  definition: {
    type: "function",
    function: {
      name: "create_markdown_file",
      description: "创建一个 Markdown 格式的文档文件。适用于生成报告、文档、笔记、总结等结构化内容。文件将保存到会话中，用户可以预览和下载。",
      parameters: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description: "文件名（不含扩展名），例如：'项目报告'、'会议纪要'",
          },
          content: {
            type: "string",
            description: "Markdown 格式的文件内容",
          },
          title: {
            type: "string",
            description: "文档标题（可选，用于在文件开头添加一级标题）",
          },
        },
        required: ["filename", "content"],
      },
    },
  },
  executor: async (args: Record<string, any>, context: ToolExecutionContext) => {
    const { filename, content, title } = args;

    if (!filename || typeof filename !== "string") {
      return {
        success: false,
        error: "文件名不能为空",
      };
    }

    if (!content || typeof content !== "string") {
      return {
        success: false,
        error: "文件内容不能为空",
      };
    }

    // 清理文件名
    const cleanFilename = filename
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\.md$/i, "")
      .trim();

    if (!cleanFilename) {
      return {
        success: false,
        error: "文件名无效",
      };
    }

    // 组装最终内容
    let finalContent = content;
    if (title && typeof title === "string") {
      finalContent = `# ${title}\n\n${content}`;
    }

    try {
      const result = createGeneratedFile({
        userId: context.userId,
        conversationId: context.conversationId,
        originalName: `${cleanFilename}.md`,
        content: finalContent,
        mimeType: "text/markdown",
      });

      return {
        success: true,
        result: {
          type: "markdown_file",
          fileId: result.file.id,
          filename: result.file.original_name,
          mimeType: result.file.mime_type,
          sizeBytes: result.file.size_bytes,
          contentUrl: `/api/ai/files/${result.file.id}/content`,
          message: `已创建 Markdown 文件：${result.file.original_name}`,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: `创建文件失败：${err.message || "未知错误"}`,
      };
    }
  },
};

/** 创建 HTML 文件 */
const createHtmlFileTool: ToolDefinition = {
  name: "create_html_file",
  callType: "view",
  definition: {
    type: "function",
    function: {
      name: "create_html_file",
      description: "创建一个 HTML 格式的网页文件。适用于生成可交互的网页、数据可视化、图表展示、演示页面等。文件将保存到会话中，用户可以在 iframe 中预览和下载。",
      parameters: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description: "文件名（不含扩展名），例如：'数据图表'、'交互演示'",
          },
          content: {
            type: "string",
            description: "完整的 HTML 文件内容，应包含 <!DOCTYPE html>、<html>、<head>、<body> 等标签。可以内联 CSS 和 JavaScript。",
          },
          title: {
            type: "string",
            description: "网页标题（可选，用于设置 <title> 标签，如果内容中未包含）",
          },
        },
        required: ["filename", "content"],
      },
    },
  },
  executor: async (args: Record<string, any>, context: ToolExecutionContext) => {
    const { filename, content, title } = args;

    if (!filename || typeof filename !== "string") {
      return {
        success: false,
        error: "文件名不能为空",
      };
    }

    if (!content || typeof content !== "string") {
      return {
        success: false,
        error: "文件内容不能为空",
      };
    }

    // 清理文件名
    const cleanFilename = filename
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\.html?$/i, "")
      .trim();

    if (!cleanFilename) {
      return {
        success: false,
        error: "文件名无效",
      };
    }

    // 组装最终内容：如果提供了 title 且内容中没有 <title>，则注入
    let finalContent = content;
    if (title && typeof title === "string" && !/<title>/i.test(content)) {
      // 尝试在 <head> 中注入 title
      if (/<head>/i.test(finalContent)) {
        finalContent = finalContent.replace(
          /<head>/i,
          `<head>\n  <title>${title}</title>`
        );
      } else if (/<html>/i.test(finalContent)) {
        // 如果没有 head 但有 html，在 html 后添加 head
        finalContent = finalContent.replace(
          /<html[^>]*>/i,
          (match) => `${match}\n<head>\n  <title>${title}</title>\n</head>`
        );
      }
    }

    try {
      const result = createGeneratedFile({
        userId: context.userId,
        conversationId: context.conversationId,
        originalName: `${cleanFilename}.html`,
        content: finalContent,
        mimeType: "text/html",
      });

      return {
        success: true,
        result: {
          type: "html_file",
          fileId: result.file.id,
          filename: result.file.original_name,
          mimeType: result.file.mime_type,
          sizeBytes: result.file.size_bytes,
          contentUrl: `/api/ai/files/${result.file.id}/content`,
          message: `已创建 HTML 文件：${result.file.original_name}`,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: `创建文件失败：${err.message || "未知错误"}`,
      };
    }
  },
};

// ============================================================================
// 导出工具包
// ============================================================================

export const creativeToolKit: ToolKit = {
  meta: {
    key: "creative",
    displayName: "创意",
    description: "创建文档、报告等创意内容",
    icon: "Sparkles",
    defaultEnabled: true,
    order: 30,
  },
  tools: [createMarkdownFileTool, createHtmlFileTool],
};
