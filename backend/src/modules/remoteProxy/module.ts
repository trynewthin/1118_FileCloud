/**
 * 远程代理模块定义
 */

import type { ModuleDefinition } from "../../core/module-loader/index.ts";
import { stopRemoteProxy } from "./lifecycle.ts";
import { remoteProxyRouter } from "./router.ts";

export const remoteProxyModule: ModuleDefinition = {
  name: "RemoteProxy",
  onShutdown: stopRemoteProxy,
  router: {
    prefix: "/api/remote-proxy",
    instance: remoteProxyRouter,
  },
};
