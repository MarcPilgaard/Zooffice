import type { ClientMessage, ServerMessage, ToolInfo } from '../../shared/protocol.js';
import { parseMessage, serializeMessage } from '../../shared/protocol.js';
import { validateRegister, validateToolInvoke, validateTalk } from './messages.js';
import type { Office } from '../office.js';

export type SendFn = (msg: ServerMessage) => void;

export class ProtocolHandler {
  private office: Office;

  constructor(office: Office) {
    this.office = office;
  }

  async handleRaw(raw: string, send: SendFn, connectionId: string): Promise<void> {
    const parsed = parseMessage(raw);
    if (!parsed) {
      send({ type: 'error', message: 'Invalid JSON', code: 'PARSE_ERROR' });
      return;
    }
    await this.handle(parsed as ClientMessage, send, connectionId);
  }

  async handle(msg: ClientMessage, send: SendFn, connectionId: string): Promise<void> {
    switch (msg.type) {
      case 'register':
        if (!validateRegister(msg)) {
          send({ type: 'error', message: 'Invalid register message', code: 'VALIDATION_ERROR' });
          return;
        }
        return this.handleRegister(msg, send, connectionId);

      case 'tool_invoke':
        if (!validateToolInvoke(msg)) {
          send({ type: 'error', message: 'Invalid tool_invoke message', code: 'VALIDATION_ERROR' });
          return;
        }
        return this.handleToolInvoke(msg, send, connectionId);

      case 'talk':
        if (!validateTalk(msg)) {
          send({ type: 'error', message: 'Invalid talk message', code: 'VALIDATION_ERROR' });
          return;
        }
        return this.handleTalk(msg, send, connectionId);

      default:
        send({ type: 'error', message: `Unknown message type`, code: 'UNKNOWN_TYPE' });
    }
  }

  private handleRegister(msg: ClientMessage & { type: 'register' }, send: SendFn, connectionId: string): void {
    const agent = this.office.registerAgent(
      { name: msg.name, title: msg.title, role: msg.role, goal: msg.goal },
      connectionId,
      send,
    );
    const tools: ToolInfo[] = this.office.listTools().map(t => ({
      name: t.name,
      description: t.description,
      kibbleCost: t.kibbleCost,
    }));
    send({
      type: 'registered',
      agentId: agent.id,
      kibble: this.office.getKibbleBalance(agent.id),
      availableTools: tools,
      office: this.office.getStateOverview(),
      serverManagedSpawning: this.office.hasSpawner,
    });
  }

  private async handleToolInvoke(msg: ClientMessage & { type: 'tool_invoke' }, send: SendFn, connectionId: string): Promise<void> {
    const agentId = this.office.getAgentIdByConnection(connectionId);
    if (!agentId) {
      send({ type: 'error', message: 'Not registered', code: 'NOT_REGISTERED' });
      return;
    }
    const result = await this.office.executeTool(agentId, msg.tool, msg.args);
    send({
      type: 'tool_result',
      requestId: msg.requestId,
      success: result.success,
      output: result.output,
      kibbleRemaining: this.office.getKibbleBalance(agentId),
    });
  }

  private handleTalk(msg: ClientMessage & { type: 'talk' }, send: SendFn, connectionId: string): void {
    const agentId = this.office.getAgentIdByConnection(connectionId);
    if (!agentId) {
      send({ type: 'error', message: 'Not registered', code: 'NOT_REGISTERED' });
      return;
    }
    // Delegate to talk tool logic through the office
    this.office.executeTool(agentId, 'talk', { to: msg.to, message: msg.message }).then(result => {
      send({
        type: 'tool_result',
        requestId: `talk-${Date.now()}`,
        success: result.success,
        output: result.output,
        kibbleRemaining: this.office.getKibbleBalance(agentId),
      });
    });
  }
}
