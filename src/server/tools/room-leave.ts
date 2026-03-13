import type { ToolDefinition } from './types.js';

export const roomLeaveTool: ToolDefinition = {
  name: 'room-leave',
  description: 'Leave a room. Args: { room: string }',
  kibbleCost: 0,
  async execute(args, ctx) {
    const room = (args.room as string)?.replace(/^#/, '');
    if (!room) return { success: false, output: 'Missing required arg: room' };
    ctx.leaveRoom(room);
    return { success: true, output: `Left room "${room}"` };
  },
};
