/**
 * 远程代理模块定义
 */

import type { ModuleDefinition } from "../../core/module-loader/index.ts";
import { remoteProxyRouter } from "./router.ts";

export const remoteProxyModule: ModuleDefinition = {
  name: "RemoteProxy",
  router: {
    prefix: "/api/remote-proxy",
    instance: remoteProxyRouter,
  },
};
