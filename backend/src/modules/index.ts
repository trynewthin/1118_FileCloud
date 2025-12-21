/**
 * 模块统一导出
 * 
 * 所有业务模块在此注册，由 ModuleLoader 统一加载
 */

import type { ModuleDefinition } from "../core/module-loader/index.ts";

// 导入所有模块定义
import { authModule } from "./auth/module.ts";
import { fileLibrariesModule } from "./fileLibraries/module.ts";
import { tasksModule } from "./tasks/module.ts";
import { filesModule } from "./files/module.ts";
import { fileContentModule } from "./fileContent/module.ts";
import { activityLogsModule } from "./activityLogs/module.ts";
import { settingsModule } from "./settings/module.ts";
import { systemModule } from "./system/module.ts";
import { aiModule } from "./ai/module.ts";
import { tagsModule } from "./tags/module.ts";
import { entriesModule } from "./entries/module.ts";
import { backgroundsModule } from "./backgrounds/module.ts";
import { remoteProxyModule } from "./remoteProxy/module.ts";

/**
 * 所有业务模块列表
 * 
 * 注意：模块加载顺序可能影响依赖关系
 * - auth 应该最先加载（其他模块可能依赖鉴权）
 * - settings 应该较早加载（其他模块可能读取配置）
 */
export const allModules: ModuleDefinition[] = [
  authModule,
  settingsModule,
  systemModule,
  fileLibrariesModule,
  tasksModule,
  filesModule,
  fileContentModule,
  activityLogsModule,
  aiModule,
  tagsModule,
  entriesModule,
  backgroundsModule,
  remoteProxyModule,
];
