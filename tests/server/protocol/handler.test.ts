import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProtocolHandler } from '../../../src/server/protocol/handler.js';
import { Office } from '../../../src/server/office.js';
import type { ServerMessage } from '../../../src/shared/protocol.js';

describe('ProtocolHandler', () => {
  let office: Office;
  let handler: ProtocolHandler;
  let sent: ServerMessage[];
  let send: (msg: ServerMessage) => void;

  beforeEach(() => {
    office = new Office();
    handler = new ProtocolHandler(office);
    sent = [];
    send = (msg) => sent.push(msg);
  });

  it('handles invalid JSON', async () => {
    await handler.handleRaw('not json', send, 'conn1');
    expect(sent[0]).toMatchObject({ type: 'error', code: 'PARSE_ERROR' });
  });

  it('handles register', async () => {
    await handler.handleRaw(
      JSON.stringify({ type: 'register', name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' }),
      send,
      'conn1',
    );
    expect(sent[0]).toMatchObject({ type: 'registered' });
    const reg = sent[0] as { agentId: string; office: { officeName: string; agents: unknown[]; rooms: unknown[] } };
    expect(reg.agentId).toBeTruthy();
    expect(reg.office.officeName).toBe('Zooffice HQ');
    expect(reg.office.agents.length).toBeGreaterThan(0);
    expect(reg.office.rooms).toEqual([]);
  });

  it('handles tool_invoke after registration', async () => {
    // Register first
    await handler.handleRaw(
      JSON.stringify({ type: 'register', name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' }),
      send,
      'conn1',
    );
    sent.length = 0;

    // Invoke a tool
    await handler.handleRaw(
      JSON.stringify({ type: 'tool_invoke', tool: 'room-enter', args: { room: 'lobby' }, requestId: 'r1' }),
      send,
      'conn1',
    );
    expect(sent[0]).toMatchObject({ type: 'tool_result', requestId: 'r1', success: true });
  });

  it('rejects tool_invoke without registration', async () => {
    await handler.handleRaw(
      JSON.stringify({ type: 'tool_invoke', tool: 'room-enter', args: { room: 'lobby' }, requestId: 'r1' }),
      send,
      'conn1',
    );
    expect(sent[0]).toMatchObject({ type: 'error', code: 'NOT_REGISTERED' });
  });
});
