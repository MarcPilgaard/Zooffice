import { AgentRegistry } from './agent/agent-registry.js';
import type { AgentConfig } from './agent/types.js';
import type { Agent } from './agent/agent.js';
import { RoomManager } from './room/room-manager.js';
import { KibbleLedger } from './kibble/ledger.js';
import { ToolRegistry } from './tools/tool-registry.js';
import type { ToolContext, ToolOutput, ToolDefinition } from './tools/types.js';
import { talkTool } from './tools/talk.js';
import { roomEnterTool } from './tools/room-enter.js';
import { roomLeaveTool } from './tools/room-leave.js';
import { bashTool } from './tools/bash-tool.js';
import { hireTool } from './tools/hire.js';
import { transferKibbleTool } from './tools/transfer-kibble.js';
import type { ServerMessage, BroadcastMessage, OfficeOverview, StateSnapshot } from '../shared/protocol.js';
import type { Logger } from './logger.js';

const INITIAL_KIBBLE = 100;
const DEFAULT_OFFICE_NAME = 'Zooffice HQ';

export type SendFn = (msg: ServerMessage) => void;
export type BroadcastFn = (msg: BroadcastMessage) => void;

export class Office {
  readonly name: string;
  readonly agents = new AgentRegistry();
  readonly rooms = new RoomManager((roomName, event, agentId, text) => {
    this.onRoomEvent(roomName, event, agentId, text);
  });
  readonly kibble = new KibbleLedger();
  readonly tools = new ToolRegistry();
  private logger?: Logger;

  private connectionToAgent = new Map<string, string>();
  private agentSenders = new Map<string, SendFn>();
  private broadcastFn?: BroadcastFn;

  constructor(broadcast?: BroadcastFn, officeName?: string, logger?: Logger) {
    this.name = officeName ?? DEFAULT_OFFICE_NAME;
    this.broadcastFn = broadcast;
    this.logger = logger;
    this.tools.register(talkTool);
    this.tools.register(roomEnterTool);
    this.tools.register(roomLeaveTool);
    this.tools.register(bashTool);
    this.tools.register(hireTool);
    this.tools.register(transferKibbleTool);
  }

  registerAgent(config: AgentConfig, connectionId: string, send: SendFn): Agent {
    // If an agent with this name was pre-hired, reuse it
    const existing = this.agents.getByName(config.name);
    if (existing && !existing.connected) {
      existing.reconnect();
      this.connectionToAgent.set(connectionId, existing.id);
      this.agentSenders.set(existing.id, send);
      this.logger?.log('agent', { event: 'reconnect', id: existing.id, name: existing.name });
      this.broadcastStateSnapshot();
      return existing;
    }

    const agent = this.agents.register(config);
    this.kibble.credit(agent.id, INITIAL_KIBBLE, 'initial');
    this.connectionToAgent.set(connectionId, agent.id);
    this.agentSenders.set(agent.id, send);
    this.logger?.log('agent', { event: 'register', id: agent.id, name: agent.name, title: config.title, role: config.role, goal: config.goal });
    this.broadcastFn?.({
      type: 'office_event',
      event: 'agent_spawned',
      data: { id: agent.id, name: agent.name, title: config.title },
    });
    this.broadcastStateSnapshot();
    return agent;
  }

  disconnectAgent(connectionId: string): void {
    const agentId = this.connectionToAgent.get(connectionId);
    if (!agentId) return;
    const agent = this.agents.get(agentId);
    if (agent) {
      this.logger?.log('agent', { event: 'disconnect', id: agentId, name: agent.name });
      for (const roomName of agent.getRooms()) {
        const room = this.rooms.get(roomName);
        room?.leave(agentId);
      }
    }
    this.agents.remove(agentId);
    this.connectionToAgent.delete(connectionId);
    this.agentSenders.delete(agentId);
    this.broadcastFn?.({
      type: 'office_event',
      event: 'agent_disconnected',
      data: { id: agentId },
    });
    this.broadcastStateSnapshot();
  }

  getAgentIdByConnection(connectionId: string): string | undefined {
    return this.connectionToAgent.get(connectionId);
  }

  getKibbleBalance(agentId: string): number {
    return this.kibble.balance(agentId);
  }

  listTools(): ToolDefinition[] {
    return this.tools.list();
  }

  getStateOverview(): OfficeOverview {
    return {
      officeName: this.name,
      agents: this.agents.list().map(a => ({
        id: a.id,
        name: a.name,
        title: a.identity.title,
        role: a.identity.role,
        rooms: a.getRooms(),
      })),
      rooms: this.rooms.list().map(name => {
        const room = this.rooms.get(name)!;
        return { name, members: room.getMembers() };
      }),
    };
  }

  async executeTool(agentId: string, toolName: string, args: Record<string, unknown>): Promise<ToolOutput> {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, output: 'Agent not found' };

    const ctx: ToolContext = {
      agentId,
      agentName: agent.name,
      debitKibble: (amount, reason) => this.kibble.debit(agentId, amount, reason),
      creditKibble: (targetId, amount, reason) => this.kibble.credit(targetId, amount, reason),
      getKibbleBalance: () => this.kibble.balance(agentId),
      joinRoom: (roomName) => {
        const room = this.rooms.getOrCreate(roomName);
        room.join(agentId);
        agent.joinRoom(roomName);
      },
      leaveRoom: (roomName) => {
        const room = this.rooms.get(roomName);
        if (room) {
          room.leave(agentId);
          agent.leaveRoom(roomName);
        }
      },
      postToRoom: (roomName, text) => {
        const room = this.rooms.get(roomName);
        if (!room) return false;
        return room.post(agentId, agent.name, text);
      },
      sendToAgent: (targetId, text) => {
        const sender = this.agentSenders.get(targetId);
        if (!sender) return false;
        sender({ type: 'message', from: agent.name, text });
        return true;
      },
      spawnAgent: (config) => {
        const spawned = this.agents.register(config);
        spawned.disconnect(); // Mark as disconnected until a client connects for it
        // Auto-join the hired agent into the specified room
        if (config.room) {
          const room = this.rooms.getOrCreate(config.room);
          room.join(spawned.id);
          spawned.joinRoom(config.room);
        }
        this.logger?.log('agent', { event: 'hired', id: spawned.id, name: spawned.name, title: config.title, hiredBy: agent.name, room: config.room });
        this.broadcastFn?.({
          type: 'office_event',
          event: 'agent_spawned',
          data: { id: spawned.id, name: spawned.name, title: config.title, hiredBy: agent.name, room: config.room },
        });
        return spawned.id;
      },
      resolveAgentName: (name) => this.agents.getByName(name)?.id,
      getRoomMembers: (roomName) => {
        const room = this.rooms.get(roomName);
        return room ? room.getMembers() : [];
      },
      getAgentRooms: () => agent.getRooms(),
    };

    const result = await this.tools.execute(toolName, args, ctx);
    const tool = this.tools.get(toolName);
    const cost = tool?.kibbleCost ?? 0;
    this.logger?.log('tool', {
      event: 'execute',
      agent: agent.name,
      agentId,
      tool: toolName,
      args,
      cost,
      success: result.success,
      output: result.output,
      kibbleRemaining: this.kibble.balance(agentId),
    });
    this.broadcastFn?.({
      type: 'office_event',
      event: 'tool_used',
      data: {
        agent: agent.name,
        tool: toolName,
        args,
        cost,
        success: result.success,
        output: result.output,
      },
    });
    this.broadcastStateSnapshot();
    return result;
  }

  private broadcastStateSnapshot(): void {
    const snapshot: StateSnapshot = {
      type: 'state_snapshot',
      officeName: this.name,
      agents: this.agents.list().map(a => ({
        name: a.name,
        title: a.identity.title,
        kibble: this.kibble.balance(a.id),
        rooms: a.getRooms(),
        connected: a.connected,
      })),
      rooms: this.rooms.list(),
    };
    this.broadcastFn?.(snapshot);
  }

  private onRoomEvent(roomName: string, event: 'message' | 'join' | 'leave', agentId: string, text?: string): void {
    const agent = this.agents.get(agentId);
    const agentName = agent?.name ?? agentId;

    this.logger?.log('room', { event, room: roomName, agent: agentName, agentId, text });

    this.broadcastFn?.({
      type: 'room_event',
      room: roomName,
      event,
      agent: agentName,
      text,
    });

    // Deliver message to room members
    if (event === 'message') {
      const room = this.rooms.get(roomName);
      if (room) {
        for (const memberId of room.getMembers()) {
          if (memberId === agentId) continue;
          const send = this.agentSenders.get(memberId);
          send?.({ type: 'message', from: agentName, room: roomName, text: text ?? '' });
        }
      }
    }
  }
}
