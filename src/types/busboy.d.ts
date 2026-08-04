declare module 'busboy' {
  import { Writable } from 'stream';

  interface BusboyOptions {
    headers: Record<string, string | string[] | undefined>;
    limits?: { fileSize?: number };
  }

  interface FileInfo {
    filename: string;
    encoding: string;
    mimeType: string;
  }

  interface BusboyInstance extends Writable {
    on(event: 'file', listener: (fieldname: string, stream: NodeJS.ReadableStream, info: FileInfo) => void): this;
    on(event: 'field' | 'finish' | 'error', listener: (...args: unknown[]) => void): this;
  }

  function Busboy(options: BusboyOptions): BusboyInstance;
  export = Busboy;
}
