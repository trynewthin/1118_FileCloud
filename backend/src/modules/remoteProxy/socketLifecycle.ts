import WebSocket from "ws";

/** Give queued responses a chance to flush, then bound the close handshake. */
export const closeSocket = (socket: WebSocket): Promise<void> => new Promise(resolve => {
  if (socket.readyState === WebSocket.CLOSED) { resolve(); return; }
  const timer = setTimeout(() => { socket.terminate(); }, 1000);
  const closed = () => { clearTimeout(timer); resolve(); };
  socket.once("close", closed);
  if (socket.readyState === WebSocket.CONNECTING) socket.terminate();
  else socket.close(1001, "Server shutting down");
});
