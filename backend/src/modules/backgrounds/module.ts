/**
 * 背景图片模块定义
 */

import type { ModuleDefinition } from "../../core/module-loader/index.ts";
import { backgroundsRouter } from "./router.ts";

export const backgroundsModule: ModuleDefinition = {
  name: "Backgrounds",
  router: {
    prefix: "/api/backgrounds",
    instance: backgroundsRouter,
  },
};
