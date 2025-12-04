/**
 * ActivityLogs 模块定义
 */

import type { ModuleDefinition } from "../../core/module-loader/index.ts";
import { activityLogsRouter } from "./router.ts";

export const activityLogsModule: ModuleDefinition = {
  name: "ActivityLogs",
  router: {
    prefix: "/api/activity-logs",
    instance: activityLogsRouter,
  },
};
