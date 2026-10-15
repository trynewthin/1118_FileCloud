import { disconnectClient } from "./wsClient.ts";
import { stopWebSocketServer } from "./wsServer.ts";

export const stopRemoteProxy = async (): Promise<void> => {
  await Promise.all([disconnectClient(), stopWebSocketServer()]);
};
