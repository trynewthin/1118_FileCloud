/**
 * System 模块定义
 */

import type { ModuleDefinition } from "../../core/module-loader/index.ts";
import { systemRouter } from "./router.ts";

export const systemModule: ModuleDefinition = {
  name: "System",
  router: {
    prefix: "/api/system",
    instance: systemRouter,
  },
};
