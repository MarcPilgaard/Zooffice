import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

export interface ClaudeWrapperOptions {
  systemPrompt?: string;
  /** Unique agent name — used to derive a stable session ID */
  agentName?: string;
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

/** Derive a unique UUID v4-shaped session ID per agent run */
function nameToSessionId(name: string): string {
  const hash = createHash('sha256').update(`zooffice-agent-${name}-${Date.now()}-${Math.random()}`).digest('hex');
  // Format as UUID: 8-4-4-4-12
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),  // version 4
    '8' + hash.slice(17, 20),  // variant
    hash.slice(20, 32),
  ].join('-');
}

export class ClaudeWrapper {
  private systemPrompt: string;
  private sessionId: string;
  private firstCall = true;

  constructor(options: ClaudeWrapperOptions = {}) {
    this.systemPrompt = options.systemPrompt ?? '';
    this.sessionId = nameToSessionId(options.agentName ?? 'default');
  }

  updateSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  async prompt(message: string): Promise<ClaudeResponse> {
    return new Promise((resolve, reject) => {
      const args = ['-p', '--output-format', 'json', '--dangerously-skip-permissions'];

      if (this.firstCall) {
        // First call: new session with system prompt via stdin
        args.push('--session-id', this.sessionId);
      } else {
        // Subsequent calls: continue the agent's session
        args.push('--continue', this.sessionId);
      }

      const stdinMessage = this.firstCall && this.systemPrompt
        ? `<system>\n${this.systemPrompt}\n</system>\n\n${message}`
        : message;

      console.log(`${new Date().toISOString()} [claude] spawning (${this.firstCall ? 'new' : 'continue'} ${this.sessionId.slice(0, 8)}, stdin: ${stdinMessage.length} chars)`);
      const proc = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CLAUDECODE: undefined, CLAUDE_CODE_ENTRYPOINT: undefined },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderr += text;
        console.error(`[claude:stderr] ${text.trimEnd()}`);
      });

      proc.stdin.end(stdinMessage);

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

        try {
          const json = JSON.parse(stdout);
          const text = (json.result ?? '').trim();
          console.log(`${new Date().toISOString()} [claude] responded (${text.length} chars)`);
          const toolCalls = parseToolCalls(text);
          resolve({ text, toolCalls });
        } catch {
          const text = stdout.trim();
          console.log(`${new Date().toISOString()} [claude] responded plain (${text.length} chars)`);
          const toolCalls = parseToolCalls(text);
          resolve({ text, toolCalls });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
}
