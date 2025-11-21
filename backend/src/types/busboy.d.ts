declare module "busboy" {
  import type { IncomingHttpHeaders } from "http";
  import type { Readable } from "stream";

  interface BusboyConfig {
    headers: IncomingHttpHeaders;
  }

  interface FileInfo {
    filename: string;
    encoding: string;
    mimeType: string;
  }

  interface BusboyFileStream extends Readable {}

  interface BusboyInstance extends NodeJS.WritableStream {
    on(event: "file", cb: (fieldname: string, file: BusboyFileStream, info: FileInfo) => void): this;
    on(event: "field", cb: (fieldname: string, value: string) => void): this;
    on(event: "finish", cb: () => void): this;
    on(event: "error", cb: (err: Error) => void): this;
  }

  function Busboy(config: BusboyConfig): BusboyInstance;
  export = Busboy;
}
