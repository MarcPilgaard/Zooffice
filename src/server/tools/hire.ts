import type { ToolDefinition } from './types.js';

export const hireTool: ToolDefinition = {
  name: 'hire',
  description: 'Hire a new agent. You must be in a room — the hired agent spawns in your current room with 0 kibble (use transfer-kibble to fund them). Args: { name: string, title: string, role: string, goal: string }',
  kibbleCost: 20,
  async execute(args, ctx) {
    const rooms = ctx.getAgentRooms();
    if (rooms.length === 0) {
      return { success: false, output: 'You must be in a room to hire an agent' };
    }

    const name = args.name as string;
    const title = args.title as string;
    const role = args.role as string;
    const goal = args.goal as string;
    if (!name || !title || !role || !goal) {
      return { success: false, output: 'Missing required args: name, title, role, goal' };
    }

    const room = rooms[0];
    const agentId = ctx.spawnAgent({ name, title, role, goal, room });
    return { success: true, output: `Hired agent "${name}" (${title}) with id ${agentId} into room "${room}"` };
  },
};
