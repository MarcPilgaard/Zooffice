import type { AgentIdentity } from './types.js';

export class Agent {
  readonly identity: AgentIdentity;
  private rooms = new Set<string>();
  private _connected = true;

  constructor(identity: AgentIdentity) {
    this.identity = identity;
  }

  get id(): string { return this.identity.id; }
  get name(): string { return this.identity.name; }
  get connected(): boolean { return this._connected; }

  joinRoom(roomName: string): void {
    this.rooms.add(roomName);
  }

  leaveRoom(roomName: string): void {
    this.rooms.delete(roomName);
  }

  getRooms(): string[] {
    return [...this.rooms];
  }

  isInRoom(roomName: string): boolean {
    return this.rooms.has(roomName);
  }

  disconnect(): void {
    this._connected = false;
  }

  reconnect(): void {
    this._connected = true;
  }
}
