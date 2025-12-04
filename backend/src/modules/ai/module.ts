/**
 * AI 模块定义
 */

import type { ModuleDefinition } from "../../core/module-loader/index.ts";
import { aiRouter } from "./router.ts";

export const aiModule: ModuleDefinition = {
  name: "AI",
  router: {
    prefix: "/api/ai",
    instance: aiRouter,
  },
};
