/**
 * FileLibraries 模块定义
 */

import type { ModuleDefinition } from "../../core/module-loader/index.ts";
import { fileLibrariesRouter } from "./router.ts";

export const fileLibrariesModule: ModuleDefinition = {
  name: "FileLibraries",
  router: {
    prefix: "/api/file-libraries",
    instance: fileLibrariesRouter,
  },
};
