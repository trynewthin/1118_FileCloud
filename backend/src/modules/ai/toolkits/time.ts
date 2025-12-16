/**
 * 时间工具包
 * 
 * 包含时间相关的工具：
 * - get_current_time: 获取当前时间
 */

import type { ToolKit, ToolDefinition } from "./types.ts";

// ============================================================================
// 工具定义
// ============================================================================

/** 获取当前时间 */
const getCurrentTimeTool: ToolDefinition = {
  name: "get_current_time",
  callType: "view",
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
};

// ============================================================================
// 导出工具包
// ============================================================================

export const timeToolKit: ToolKit = {
  meta: {
    key: "time",
    displayName: "时间",
    description: "获取当前日期和时间",
    icon: "Clock",
    defaultEnabled: true,
    order: 20,
  },
  tools: [getCurrentTimeTool],
};
