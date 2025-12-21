export { remoteProxyModule } from "./module.ts";
export { initWebSocketServer, getConnectedClients, isClientOnline, sendRequest } from "./wsServer.ts";
export { initWebSocketClient, disconnectClient } from "./wsClient.ts";
export type { RemoteClient, RemoteAction, ProxyMessage } from "./types.ts";
