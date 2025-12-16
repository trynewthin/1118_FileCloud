/**
 * 工具包统一入口
 * 
 * 负责：
 * - 导出所有工具包
 * - 提供统一的初始化函数
 */

// 类型导出
export * from "./types.ts";

// Registry 导出
export {
  registerToolKit,
  registerToolKits,
  getAllToolKits,
  getToolKitByKey,
  getToolByName,
  getToolKitList,
  getSystemDefaultToolKits,
  resolveEnabledToolKitKeys,
  assembleToolDefinitions,
  getEnabledToolDefinitions,
  executeTool,
  isToolInToolKit,
  getToolKitKeyByToolName,
} from "./registry.ts";

// 工具包导出
export { fileLibraryToolKit } from "./fileLibrary.ts";
export { timeToolKit } from "./time.ts";
export { creativeToolKit } from "./creative.ts";

// ============================================================================
// 初始化
// ============================================================================

import { registerToolKits } from "./registry.ts";
import { fileLibraryToolKit } from "./fileLibrary.ts";
import { timeToolKit } from "./time.ts";
import { creativeToolKit } from "./creative.ts";

/** 所有内置工具包 */
const builtinToolKits = [
  fileLibraryToolKit,
  timeToolKit,
  creativeToolKit,
];

/** 是否已初始化 */
let initialized = false;

/**
 * 初始化工具包系统
 * 注册所有内置工具包
 */
export const initializeToolKits = (): void => {
  if (initialized) {
    return;
  }

  registerToolKits(builtinToolKits);
  initialized = true;

  console.log(
    `[ToolKits] 已注册 ${builtinToolKits.length} 个工具包，共 ${builtinToolKits.reduce((sum, tk) => sum + tk.tools.length, 0)} 个工具`,
  );
};

/**
 * 获取所有内置工具包（用于测试或调试）
 */
export const getBuiltinToolKits = () => builtinToolKits;
