/**
 * Auth 模块定义
 */

import type { ModuleDefinition } from "../../core/module-loader/index.ts";
import { authRouter } from "./router.ts";

export const authModule: ModuleDefinition = {
  name: "Auth",
  router: {
    prefix: "/api/auth",
    instance: authRouter,
  },
};
