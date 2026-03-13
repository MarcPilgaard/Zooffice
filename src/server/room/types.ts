export interface RoomMessage {
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface RoomConfig {
  name: string;
  topic?: string;
}

export type RoomEventType = 'message' | 'join' | 'leave';

export interface RoomEventCallback {
  (roomName: string, event: RoomEventType, agentId: string, text?: string): void;
}
