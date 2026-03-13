import type { RoomMessage, RoomEventCallback } from './types.js';

export class Room {
  readonly name: string;
  private members = new Set<string>();
  private log: RoomMessage[] = [];
  private joinIndex = new Map<string, number>();
  private onEvent?: RoomEventCallback;

  constructor(name: string, onEvent?: RoomEventCallback) {
    this.name = name;
    this.onEvent = onEvent;
  }

  join(agentId: string): boolean {
    if (this.members.has(agentId)) return false;
    this.members.add(agentId);
    this.joinIndex.set(agentId, this.log.length);
    this.onEvent?.(this.name, 'join', agentId);
    return true;
  }

  leave(agentId: string): boolean {
    if (!this.members.has(agentId)) return false;
    this.members.delete(agentId);
    this.joinIndex.delete(agentId);
    this.onEvent?.(this.name, 'leave', agentId);
    return true;
  }

  post(senderId: string, senderName: string, text: string): boolean {
    if (!this.members.has(senderId)) return false;
    const msg: RoomMessage = { senderId, senderName, text, timestamp: Date.now() };
    this.log.push(msg);
    this.onEvent?.(this.name, 'message', senderId, text);
    return true;
  }

  getMembers(): string[] {
    return [...this.members];
  }

  hasMember(agentId: string): boolean {
    return this.members.has(agentId);
  }

  getVisibleMessages(agentId: string): RoomMessage[] {
    const idx = this.joinIndex.get(agentId);
    if (idx === undefined) return [];
    return this.log.slice(idx);
  }

  getLog(): RoomMessage[] {
    return [...this.log];
  }
}
