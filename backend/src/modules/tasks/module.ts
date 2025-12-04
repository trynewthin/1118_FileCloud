/**
 * Tasks 模块定义
 */

import type { ModuleDefinition } from "../../core/module-loader/index.ts";
import { tasksRouter } from "./router.ts";

export const tasksModule: ModuleDefinition = {
  name: "Tasks",
  router: {
    prefix: "/api/tasks",
    instance: tasksRouter,
  },
};
