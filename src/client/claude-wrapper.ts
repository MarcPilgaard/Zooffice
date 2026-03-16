import { spawn } from 'node:child_process';
import { v4 as uuidv4 } from 'uuid';

export interface ClaudeWrapperOptions {
  systemPrompt?: string;
}

export interface ClaudeResponse {
  text: string;
  toolCalls: ToolCall[];
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export function parseToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const regex = /^--(\w[\w-]*)\s*(\{.*\})?$/gm;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const tool = match[1];
    let args: Record<string, unknown> = {};
    if (match[2]) {
      try { args = JSON.parse(match[2]); } catch { /* ignore */ }
    }
    calls.push({ tool, args });
  }
  return calls;
}

export class ClaudeWrapper {
  private systemPrompt: string;
  private sessionId: string;
  private firstCall = true;

  constructor(options: ClaudeWrapperOptions = {}) {
    this.systemPrompt = options.systemPrompt ?? '';
    this.sessionId = uuidv4();
  }

  updateSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  async prompt(message: string): Promise<ClaudeResponse> {
    return new Promise((resolve, reject) => {
      console.log('[claude] spawning...');
      const args = ['-p', '--output-format', 'text', '--dangerously-skip-permissions'];

      if (this.firstCall) {
        args.push('--session-id', this.sessionId);
        if (this.systemPrompt) {
          args.push('--system-prompt', this.systemPrompt);
        }
      } else {
        args.push('--resume', this.sessionId);
      }

      const proc = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CLAUDECODE: undefined },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.stdin.write(message);
      proc.stdin.end();

      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('claude timed out after 120s'));
      }, 120_000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`claude exited with code ${code}: ${stderr}`));
          return;
        }
        this.firstCall = false;
        const text = stdout.trim();
        console.log(`[claude] responded (${text.length} chars)`);
        const toolCalls = parseToolCalls(text);
        resolve({ text, toolCalls });
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
}
