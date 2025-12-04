/**
 * Tags 模块定义
 */

import type { ModuleDefinition } from "../../core/module-loader/index.ts";
import { tagsRouter } from "./router.ts";

export const tagsModule: ModuleDefinition = {
  name: "Tags",
  router: {
    prefix: "/api/tags",
    instance: tagsRouter,
  },
};
