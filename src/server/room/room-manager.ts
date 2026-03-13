import { Room } from './room.js';
import type { RoomEventCallback } from './types.js';

export class RoomManager {
  private rooms = new Map<string, Room>();
  private onEvent?: RoomEventCallback;

  constructor(onEvent?: RoomEventCallback) {
    this.onEvent = onEvent;
  }

  create(name: string): Room {
    if (this.rooms.has(name)) {
      return this.rooms.get(name)!;
    }
    const room = new Room(name, this.onEvent);
    this.rooms.set(name, room);
    return room;
  }

  get(name: string): Room | undefined {
    return this.rooms.get(name);
  }

  getOrCreate(name: string): Room {
    return this.get(name) ?? this.create(name);
  }

  list(): string[] {
    return [...this.rooms.keys()];
  }

  delete(name: string): boolean {
    return this.rooms.delete(name);
  }

  findByAgent(agentId: string): Room[] {
    return [...this.rooms.values()].filter(r => r.hasMember(agentId));
  }
}
