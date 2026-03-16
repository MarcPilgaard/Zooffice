import WebSocket from 'ws';
import { spawn as nodeSpawn } from 'node:child_process';
import { v4 as uuidv4 } from 'uuid';
import { parseMessage, serializeMessage } from '../shared/protocol.js';
import type { ServerMessage, ClientMessage, IncomingMessage, RegisteredMessage, ToolResultMessage } from '../shared/protocol.js';
import { ClaudeWrapper, parseToolCalls } from './claude-wrapper.js';

export interface BridgeOptions {
  serverUrl: string;
  name: string;
  title: string;
  role: string;
  goal: string;
}

function ts(): string {
  return new Date().toISOString();
}

export class Bridge {
  private ws: WebSocket | null = null;
  private wrapper: ClaudeWrapper;
  private options: BridgeOptions;
  private agentId: string | null = null;
  private pendingToolCalls = new Set<string>();
  private pendingHires = new Map<string, { name: string; title: string; role: string; goal: string }>();
  private childProcesses: ReturnType<typeof nodeSpawn>[] = [];
  private inbox: string[] = [];
  private busy = false;
  private knownTools = new Set<string>();
  private serverManagedSpawning = false;

  constructor(options: BridgeOptions) {
    this.options = options;
    this.wrapper = new ClaudeWrapper({
      systemPrompt: this.buildSystemPrompt(),
      agentName: options.name,
    });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.options.serverUrl);
      this.ws.on('open', () => {
        this.send({
          type: 'register',
          name: this.options.name,
          title: this.options.title,
          role: this.options.role,
          goal: this.options.goal,
        });
        resolve();
      });
      this.ws.on('message', (data) => this.handleMessage(data.toString()));
      this.ws.on('error', reject);
      this.ws.on('close', () => { this.ws = null; });
    });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    for (const child of this.childProcesses) {
      child.kill();
    }
    this.childProcesses = [];
  }

  private spawnChildAgent(config: { name: string; title: string; role: string; goal: string }): void {
    console.log(`${ts()} [spawn] Starting client for ${config.name} (${config.title})...`);
    const child = nodeSpawn('zooffice', [
      'client', 'connect',
      '-s', this.options.serverUrl,
      '-n', config.name,
      '-t', config.title,
      '-r', config.role,
      '-g', config.goal,
    ], {
      stdio: 'ignore',
      detached: true,
      env: { ...process.env, CLAUDECODE: undefined },
    });
    child.unref();
    this.childProcesses.push(child);
    console.log(`${ts()} [spawn] ${config.name} launched (pid: ${child.pid})`);
  }

  private send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(serializeMessage(msg));
    }
  }

  private async handleMessage(raw: string): Promise<void> {
    const msg = parseMessage(raw) as ServerMessage | null;
    if (!msg) return;

    switch (msg.type) {
      case 'registered': {
        const reg = msg as RegisteredMessage;
        this.agentId = reg.agentId;
        this.knownTools = new Set(reg.availableTools.map(t => t.name));
        this.serverManagedSpawning = reg.serverManagedSpawning ?? false;
        // Rebuild system prompt with actual tool definitions from server
        this.wrapper.updateSystemPrompt(this.buildSystemPrompt(reg.availableTools));
        const toolList = reg.availableTools
          .map(t => `  --${t.name} (${t.kibbleCost} kibble) — ${t.description}`)
          .join('\n');
        const summary = `You are now registered in "${reg.office.officeName}" with ${reg.kibble} kibble.\n` +
          `Agents: ${reg.office.agents.map(a => `${a.name} (${a.title})`).join(', ') || 'none'}\n` +
          `Rooms: ${reg.office.rooms.map(r => `${r.name} (${r.members.length} members)`).join(', ') || 'none'}\n\n` +
          `YOUR ONLY AVAILABLE TOOLS (do not invent others):\n${toolList}`;
        console.log(`${ts()} ← ${summary}`);
        this.enqueue(summary);
        break;
      }

      case 'message': {
        const im = msg as IncomingMessage;
        if (im.from === this.options.name) break; // ignore own messages
        const prefix = im.room ? `[${im.room}] ${im.from}` : im.from;
        const line = `${prefix}: ${im.text}`;
        console.log(`${ts()} ← ${line}`);
        this.enqueue(line);
        break;
      }

      case 'tool_result': {
        const tr = msg as ToolResultMessage;
        const line = `[tool_result ${tr.requestId}] ${tr.success ? 'OK' : 'FAIL'}: ${tr.output} (kibble: ${tr.kibbleRemaining})`;
        console.log(`${ts()} ← ${line}`);
        this.pendingToolCalls.delete(tr.requestId);
        this.inbox.push(line);

        // If this was a successful hire, spawn a client for the new agent
        // (skip if the server manages spawning, e.g. via Docker)
        if (tr.success && this.pendingHires.has(tr.requestId)) {
          const hire = this.pendingHires.get(tr.requestId)!;
          this.pendingHires.delete(tr.requestId);
          if (!this.serverManagedSpawning) {
            this.spawnChildAgent(hire);
          }
        }

        // Wait until all pending results are back before calling Claude
        if (this.pendingToolCalls.size === 0) {
          await this.flush();
        }
        break;
      }

      case 'error':
        console.error(`${ts()} Server error: ${msg.message} (${msg.code})`);
        break;
    }
  }

  private enqueue(line: string): void {
    this.inbox.push(line);
    if (this.pendingToolCalls.size === 0) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.busy || this.inbox.length === 0) return;

    this.busy = true;
    try {
      const message = this.inbox.join('\n');
      this.inbox = [];

      const response = await this.wrapper.prompt(message);
      console.log(`${ts()} → ${response.text}`);

      if (response.toolCalls.length > 0) {
        for (const tc of response.toolCalls) {
          if (!this.knownTools.has(tc.tool)) {
            console.log(`${ts()} [bridge] ignoring unknown tool: ${tc.tool}`);
            continue;
          }
          const requestId = uuidv4();
          this.pendingToolCalls.add(requestId);
          if (tc.tool === 'hire') {
            this.pendingHires.set(requestId, {
              name: tc.args.name as string,
              title: tc.args.title as string,
              role: tc.args.role as string,
              goal: tc.args.goal as string,
            });
          }
          this.send({ type: 'tool_invoke', tool: tc.tool, args: tc.args, requestId });
        }
      }
    } catch (err) {
      console.error(`${ts()} Claude error:`, (err as Error).message);
    } finally {
      this.busy = false;
      // If more messages arrived while we were busy, flush again
      if (this.inbox.length > 0 && this.pendingToolCalls.size === 0) {
        await this.flush();
      }
    }
  }

  private buildSystemPrompt(tools?: Array<{ name: string; description: string; kibbleCost: number }>): string {
    let toolDocs = '';
    if (tools && tools.length > 0) {
      toolDocs = '\n\nAvailable tools (invoke on its own line as --tool-name {args}):\n' +
        tools.map(t => `  --${t.name} (cost: ${t.kibbleCost} kibble) — ${t.description}`).join('\n');
    }

    return `You are ${this.options.name}, the ${this.options.title}. Role: ${this.options.role}. Goal: ${this.options.goal}.

You are an autonomous agent in the Zooffice. There is no human. You receive messages from the server and from other agents. You decide what to do on your own. Never ask questions or wait for instructions.
${toolDocs}

Tool calls are optional. If you have nothing to do, output nothing. You will be called again when new messages arrive.
Failed tool calls do not cost kibble. Only successful calls are charged.
Do not repeat yourself.`;
  }
}
