import type { ToolDefinition } from './types.js';

export const roomEnterTool: ToolDefinition = {
  name: 'room-enter',
  description: 'Enter a room (leaves your current room). You can only be in one room at a time. Creates the room if it does not exist. Args: { room: string }',
  kibbleCost: 0,
  async execute(args, ctx) {
    const room = (args.room as string)?.replace(/^#/, '');
    if (!room) return { success: false, output: 'Missing required arg: room' };
    const currentRooms = ctx.getAgentRooms();
    if (currentRooms.includes(room)) {
      return { success: false, output: `Already in room "${room}"` };
    }
    // Leave current room first — agents can only be in one room at a time
    for (const r of currentRooms) {
      ctx.leaveRoom(r);
    }
    ctx.joinRoom(room);
    return { success: true, output: `Entered room "${room}"` };
  },
};
