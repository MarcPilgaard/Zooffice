import type { ToolDefinition } from './types.js';

export const transferKibbleTool: ToolDefinition = {
  name: 'transfer-kibble',
  description: 'Transfer kibble to another agent. Free to use. Args: { to: string (agent name), amount: number (positive) }',
  kibbleCost: 0,
  async execute(args, ctx) {
    const toName = args.to as string;
    const amount = args.amount as number;
    if (!toName || !amount || amount <= 0) {
      return { success: false, output: 'Missing or invalid args: to (agent name), amount (positive number)' };
    }
    const targetId = ctx.resolveAgentName(toName);
    if (!targetId) {
      return { success: false, output: `Unknown agent "${toName}"` };
    }
    const ok = ctx.debitKibble(amount, `transfer to ${toName}`);
    if (!ok) {
      return { success: false, output: `Insufficient kibble. Have ${ctx.getKibbleBalance()}, need ${amount}.` };
    }
    ctx.creditKibble(targetId, amount, `transfer from ${ctx.agentName}`);
    return { success: true, output: `Transferred ${amount} kibble to ${toName}. Remaining: ${ctx.getKibbleBalance()}` };
  },
};
