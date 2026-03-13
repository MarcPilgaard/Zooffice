export interface ToolContext {
  agentId: string;
  agentName: string;
  debitKibble: (amount: number, reason: string) => boolean;
  getKibbleBalance: () => number;
  joinRoom: (roomName: string) => void;
  leaveRoom: (roomName: string) => void;
  postToRoom: (roomName: string, text: string) => boolean;
  sendToAgent: (targetAgentId: string, text: string) => boolean;
  spawnAgent: (config: { name: string; title: string; role: string; goal: string; room?: string }) => string;
  resolveAgentName: (name: string) => string | undefined;
  getRoomMembers: (roomName: string) => string[];
  getAgentRooms: () => string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  kibbleCost: number;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolOutput>;
}

export interface ToolOutput {
  success: boolean;
  output: string;
}
