// ── Client → Server messages ──

export interface RegisterMessage {
  type: 'register';
  name: string;
  title: string;
  role: string;
  goal: string;
}

export interface ToolInvokeMessage {
  type: 'tool_invoke';
  tool: string;
  args: Record<string, unknown>;
  requestId: string;
}

export interface TalkMessage {
  type: 'talk';
  to: string;
  message: string;
}

export type ClientMessage = RegisterMessage | ToolInvokeMessage | TalkMessage;

// ── Server → Client messages ──

export interface ToolInfo {
  name: string;
  description: string;
  kibbleCost: number;
}

export interface AgentInfo {
  id: string;
  name: string;
  title: string;
  role: string;
  rooms: string[];
}

export interface RoomInfo {
  name: string;
  members: string[];
}

export interface OfficeOverview {
  officeName: string;
  agents: AgentInfo[];
  rooms: RoomInfo[];
}

export interface RegisteredMessage {
  type: 'registered';
  agentId: string;
  kibble: number;
  availableTools: ToolInfo[];
  office: OfficeOverview;
}

export interface IncomingMessage {
  type: 'message';
  from: string;
  room?: string;
  text: string;
}

export interface ToolResultMessage {
  type: 'tool_result';
  requestId: string;
  success: boolean;
  output: string;
  kibbleRemaining: number;
}

export interface StateUpdateMessage {
  type: 'state_update';
  event: string;
  data: unknown;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
  code: string;
}

export type ServerMessage =
  | RegisteredMessage
  | IncomingMessage
  | ToolResultMessage
  | StateUpdateMessage
  | ErrorMessage;

// ── Server → Renderer (broadcast) messages ──

export interface RoomEvent {
  type: 'room_event';
  room: string;
  event: 'message' | 'join' | 'leave';
  agent: string;
  text?: string;
}

export interface OfficeEvent {
  type: 'office_event';
  event: 'agent_spawned' | 'agent_disconnected' | 'kibble_transfer' | 'tool_used';
  data: unknown;
}

export interface AgentStatus {
  name: string;
  title: string;
  kibble: number;
  rooms: string[];
  connected: boolean;
}

export interface StateSnapshot {
  type: 'state_snapshot';
  officeName: string;
  agents: AgentStatus[];
  rooms: string[];
}

export type BroadcastMessage = RoomEvent | OfficeEvent | StateSnapshot;

// ── Utilities ──

export type AnyMessage = ClientMessage | ServerMessage | BroadcastMessage;

const CLIENT_TYPES = new Set(['register', 'tool_invoke', 'talk']);
const SERVER_TYPES = new Set(['registered', 'message', 'tool_result', 'state_update', 'error']);
const BROADCAST_TYPES = new Set(['room_event', 'office_event', 'state_snapshot']);

export function isClientMessage(msg: unknown): msg is ClientMessage {
  return typeof msg === 'object' && msg !== null && 'type' in msg &&
    CLIENT_TYPES.has((msg as { type: string }).type);
}

export function isServerMessage(msg: unknown): msg is ServerMessage {
  return typeof msg === 'object' && msg !== null && 'type' in msg &&
    SERVER_TYPES.has((msg as { type: string }).type);
}

export function isBroadcastMessage(msg: unknown): msg is BroadcastMessage {
  return typeof msg === 'object' && msg !== null && 'type' in msg &&
    BROADCAST_TYPES.has((msg as { type: string }).type);
}

export function parseMessage(raw: string): AnyMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) return null;
    return parsed as AnyMessage;
  } catch {
    return null;
  }
}

export function serializeMessage(msg: AnyMessage): string {
  return JSON.stringify(msg);
}
