import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';

export class Logger {
  private stream: WriteStream;
  private closed = false;
  readonly filePath: string;

  constructor(dir = 'logs') {
    mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    this.filePath = join(dir, `zooffice-${ts}.jsonl`);
    this.stream = createWriteStream(this.filePath, { flags: 'a' });
  }

  log(category: string, data: unknown): void {
    if (this.closed) return;
    const entry = {
      t: new Date().toISOString(),
      cat: category,
      ...((typeof data === 'object' && data !== null) ? data : { value: data }),
    };
    this.stream.write(JSON.stringify(entry) + '\n');
  }

  close(): void {
    this.closed = true;
    this.stream.end();
  }
}
