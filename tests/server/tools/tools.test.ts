import { describe, it, expect, vi } from 'vitest';
import type { ToolContext } from '../../../src/server/tools/types.js';
import { talkTool } from '../../../src/server/tools/talk.js';
import { roomEnterTool } from '../../../src/server/tools/room-enter.js';
import { roomLeaveTool } from '../../../src/server/tools/room-leave.js';
import { hireTool } from '../../../src/server/tools/hire.js';
import { transferKibbleTool } from '../../../src/server/tools/transfer-kibble.js';

function mockCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    agentId: 'a1',
    agentName: 'Rex',
    debitKibble: vi.fn(() => true),
    creditKibble: vi.fn(),
    getKibbleBalance: vi.fn(() => 100),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    postToRoom: vi.fn(() => true),
    sendToAgent: vi.fn(() => true),
    spawnAgent: vi.fn(() => 'new-id'),
    resolveAgentName: vi.fn(() => 'target-id'),
    getRoomMembers: vi.fn(() => []),
    getAgentRooms: vi.fn(() => ['lobby']),
    ...overrides,
  };
}

describe('talk tool', () => {
  it('sends to room if room has members', async () => {
    const ctx = mockCtx({ getRoomMembers: vi.fn(() => ['a1', 'a2']) });
    const result = await talkTool.execute({ to: 'lobby', message: 'hi' }, ctx);
    expect(result.success).toBe(true);
    expect(ctx.postToRoom).toHaveBeenCalledWith('lobby', 'hi');
  });

  it('sends to agent by name if not a room', async () => {
    const ctx = mockCtx({ getRoomMembers: vi.fn(() => []) });
    const result = await talkTool.execute({ to: 'Fido', message: 'hi' }, ctx);
    expect(result.success).toBe(true);
    expect(ctx.sendToAgent).toHaveBeenCalledWith('target-id', 'hi');
  });

  it('fails if neither room nor agent', async () => {
    const ctx = mockCtx({
      getRoomMembers: vi.fn(() => []),
      resolveAgentName: vi.fn(() => undefined),
    });
    const result = await talkTool.execute({ to: 'nobody', message: 'hi' }, ctx);
    expect(result.success).toBe(false);
  });

  it('requires to and message', async () => {
    const result = await talkTool.execute({}, mockCtx());
    expect(result.success).toBe(false);
  });
});

describe('room-enter tool', () => {
  it('joins a room', async () => {
    const ctx = mockCtx();
    const result = await roomEnterTool.execute({ room: 'kitchen' }, ctx);
    expect(result.success).toBe(true);
    expect(ctx.joinRoom).toHaveBeenCalledWith('kitchen');
  });

  it('fails without room arg', async () => {
    const result = await roomEnterTool.execute({}, mockCtx());
    expect(result.success).toBe(false);
  });
});

describe('room-leave tool', () => {
  it('leaves a room', async () => {
    const ctx = mockCtx();
    const result = await roomLeaveTool.execute({ room: 'kitchen' }, ctx);
    expect(result.success).toBe(true);
    expect(ctx.leaveRoom).toHaveBeenCalledWith('kitchen');
  });
});

describe('hire tool', () => {
  it('spawns a new agent into the current room', async () => {
    const ctx = mockCtx();
    const result = await hireTool.execute(
      { name: 'Fido', title: 'Intern', role: 'helper', goal: 'help' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(ctx.spawnAgent).toHaveBeenCalledWith({
      name: 'Fido', title: 'Intern', role: 'helper', goal: 'help', room: 'lobby',
    });
    expect(result.output).toContain('lobby');
  });

  it('fails if not in a room', async () => {
    const ctx = mockCtx({ getAgentRooms: vi.fn(() => []) });
    const result = await hireTool.execute(
      { name: 'Fido', title: 'Intern', role: 'helper', goal: 'help' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain('must be in a room');
  });

  it('fails with missing args', async () => {
    const result = await hireTool.execute({ name: 'Fido' }, mockCtx());
    expect(result.success).toBe(false);
  });
});

describe('transfer-kibble tool', () => {
  it('transfers kibble and notifies recipient', async () => {
    const ctx = mockCtx();
    const result = await transferKibbleTool.execute({ to: 'Fido', amount: 10 }, ctx);
    expect(result.success).toBe(true);
    expect(ctx.debitKibble).toHaveBeenCalledWith(10, 'transfer to Fido');
    expect(ctx.creditKibble).toHaveBeenCalledWith('target-id', 10, 'transfer from Rex');
    expect(ctx.sendToAgent).toHaveBeenCalledWith('target-id', 'You received 10 kibble from Rex.');
  });

  it('fails on insufficient funds', async () => {
    const ctx = mockCtx({ debitKibble: vi.fn(() => false), getKibbleBalance: vi.fn(() => 5) });
    const result = await transferKibbleTool.execute({ to: 'Fido', amount: 10 }, ctx);
    expect(result.success).toBe(false);
  });

  it('fails for unknown agent', async () => {
    const ctx = mockCtx({ resolveAgentName: vi.fn(() => undefined) });
    const result = await transferKibbleTool.execute({ to: 'Nobody', amount: 10 }, ctx);
    expect(result.success).toBe(false);
  });
});
