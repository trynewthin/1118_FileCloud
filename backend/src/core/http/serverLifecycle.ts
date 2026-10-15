import http, { type RequestListener } from "node:http";

/** Track admitted responses explicitly: Bun's HTTP close callback can remain
 * pending after a WebSocket upgrade, even once those sockets have closed. */
export const createTrackedHttpServer = (handler: RequestListener) => {
  let accepting = true;
  let active = 0;
  const waiters = new Set<() => void>();
  const server = http.createServer((request, response) => {
    if (!accepting) {
      response.writeHead(503, { Connection: "close" });
      response.end("Server shutting down");
      return;
    }
    active++;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      response.off("finish", finish);
      response.off("close", finish);
      active--;
      if (active === 0) {
        for (const resolve of waiters) resolve();
        waiters.clear();
      }
    };
    response.once("finish", finish);
    response.once("close", finish);
    handler(request, response);
  });
  const stopAdmission = async (): Promise<void> => {
    accepting = false;
    server.close();
    server.closeIdleConnections?.();
    if (active > 0) await new Promise<void>(resolve => waiters.add(resolve));
  };
  const closeConnections = () => { server.closeAllConnections?.(); };
  return { server, stopAdmission, closeConnections };
};
