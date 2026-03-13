import type { ToolDefinition, ToolContext, ToolOutput } from './types.js';

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  async execute(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, output: `Unknown tool: ${name}` };
    }
    if (tool.kibbleCost > 0 && ctx.getKibbleBalance() < tool.kibbleCost) {
      return { success: false, output: `Insufficient kibble. Need ${tool.kibbleCost}, have ${ctx.getKibbleBalance()}.` };
    }
    try {
      const result = await tool.execute(args, ctx);
      // Only charge kibble on success
      if (result.success && tool.kibbleCost > 0) {
        ctx.debitKibble(tool.kibbleCost, `tool:${name}`);
      }
      return result;
    } catch (err) {
      return { success: false, output: `Tool error: ${(err as Error).message}` };
    }
  }
}
