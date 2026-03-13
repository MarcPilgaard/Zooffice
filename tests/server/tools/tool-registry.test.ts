import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolRegistry } from '../../../src/server/tools/tool-registry.js';
import type { ToolDefinition, ToolContext } from '../../../src/server/tools/types.js';

function mockCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    agentId: 'a1',
    agentName: 'Rex',
    debitKibble: vi.fn(() => true),
    getKibbleBalance: vi.fn(() => 100),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    postToRoom: vi.fn(() => true),
    sendToAgent: vi.fn(() => true),
    spawnAgent: vi.fn(() => 'new-id'),
    resolveAgentName: vi.fn(() => 'a2'),
    getRoomMembers: vi.fn(() => []),
    ...overrides,
  };
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  const echoTool: ToolDefinition = {
    name: 'echo',
    description: 'Echoes input',
    kibbleCost: 2,
    execute: async (args) => ({ success: true, output: String(args.text) }),
  };

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('registers and retrieves tools', () => {
    registry.register(echoTool);
    expect(registry.get('echo')).toBe(echoTool);
  });

  it('lists tools', () => {
    registry.register(echoTool);
    expect(registry.list()).toHaveLength(1);
  });

  it('returns error for unknown tool', async () => {
    const result = await registry.execute('nope', {}, mockCtx());
    expect(result.success).toBe(false);
    expect(result.output).toContain('Unknown tool');
  });

  it('executes tool and debits kibble', async () => {
    registry.register(echoTool);
    const ctx = mockCtx();
    const result = await registry.execute('echo', { text: 'hi' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toBe('hi');
    expect(ctx.debitKibble).toHaveBeenCalledWith(2, 'tool:echo');
  });

  it('fails if insufficient kibble', async () => {
    registry.register(echoTool);
    const ctx = mockCtx({ debitKibble: vi.fn(() => false), getKibbleBalance: vi.fn(() => 1) });
    const result = await registry.execute('echo', { text: 'hi' }, ctx);
    expect(result.success).toBe(false);
    expect(result.output).toContain('Insufficient kibble');
  });

  it('skips debit for free tools', async () => {
    const freeTool: ToolDefinition = {
      name: 'free',
      description: 'Free tool',
      kibbleCost: 0,
      execute: async () => ({ success: true, output: 'ok' }),
    };
    registry.register(freeTool);
    const ctx = mockCtx();
    await registry.execute('free', {}, ctx);
    expect(ctx.debitKibble).not.toHaveBeenCalled();
  });

  it('catches tool execution errors', async () => {
    const badTool: ToolDefinition = {
      name: 'bad',
      description: 'Throws',
      kibbleCost: 0,
      execute: async () => { throw new Error('boom'); },
    };
    registry.register(badTool);
    const result = await registry.execute('bad', {}, mockCtx());
    expect(result.success).toBe(false);
    expect(result.output).toContain('boom');
  });
});
