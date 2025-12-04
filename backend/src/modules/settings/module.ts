/**
 * Settings 模块定义
 */

import type { ModuleDefinition } from "../../core/module-loader/index.ts";
import { settingsRouter } from "./router.ts";

export const settingsModule: ModuleDefinition = {
  name: "Settings",
  router: {
    prefix: "/api/settings",
    instance: settingsRouter,
  },
};
