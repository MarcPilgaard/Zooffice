import type { ToolDefinition } from './types.js';

export const talkTool: ToolDefinition = {
  name: 'talk',
  description: 'Send a message to a room or agent. You must be a member of the room to post. Args: { to: string (room name or agent name), message: string }',
  kibbleCost: 1,
  async execute(args, ctx) {
    const to = (args.to as string)?.replace(/^#/, '');
    const message = args.message as string;
    if (!to || !message) {
      return { success: false, output: 'Missing required args: to, message' };
    }

    // Try as room first
    const roomMembers = ctx.getRoomMembers(to);
    if (roomMembers.length > 0) {
      const ok = ctx.postToRoom(to, message);
      if (ok) return { success: true, output: `Message posted to room "${to}"` };
      return { success: false, output: `Could not post to room "${to}". Are you a member?` };
    }

    // Try as agent name
    const targetId = ctx.resolveAgentName(to);
    if (targetId) {
      const ok = ctx.sendToAgent(targetId, message);
      if (ok) return { success: true, output: `Message sent to ${to}` };
      return { success: false, output: `Could not send to ${to}` };
    }

    return { success: false, output: `Unknown target "${to}". Not a room or known agent.` };
  },
};
