/**
 * Entries 模块定义（统一文件访问 API）
 */

import type { ModuleDefinition } from "../../core/module-loader/index.ts";
import { entriesRouter } from "./router.ts";

export const entriesModule: ModuleDefinition = {
  name: "Entries",
  router: {
    prefix: "/api/entries",
    instance: entriesRouter,
  },
};
