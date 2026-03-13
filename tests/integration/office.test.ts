import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Office } from '../../src/server/office.js';
import type { ServerMessage, BroadcastMessage } from '../../src/shared/protocol.js';

describe('Office integration', () => {
  let office: Office;
  let broadcasts: BroadcastMessage[];

  beforeEach(() => {
    broadcasts = [];
    office = new Office((msg) => broadcasts.push(msg));
  });

  it('registers an agent with initial kibble', () => {
    const sent: ServerMessage[] = [];
    const agent = office.registerAgent(
      { name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' },
      'conn1',
      (msg) => sent.push(msg),
    );
    expect(agent.name).toBe('Rex');
    expect(office.getKibbleBalance(agent.id)).toBe(100);
    expect(broadcasts.some(b => b.type === 'office_event' && b.event === 'agent_spawned')).toBe(true);
  });

  it('agent joins room and posts message', async () => {
    const sent1: ServerMessage[] = [];
    const sent2: ServerMessage[] = [];
    const a1 = office.registerAgent({ name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' }, 'conn1', (msg) => sent1.push(msg));
    const a2 = office.registerAgent({ name: 'Fido', title: 'CTO', role: 'tech', goal: 'code' }, 'conn2', (msg) => sent2.push(msg));

    // Both enter lobby
    await office.executeTool(a1.id, 'room-enter', { room: 'lobby' });
    await office.executeTool(a2.id, 'room-enter', { room: 'lobby' });

    // Rex talks in lobby
    const result = await office.executeTool(a1.id, 'talk', { to: 'lobby', message: 'hello everyone' });
    expect(result.success).toBe(true);

    // Fido should have received the message
    expect(sent2.some(m => m.type === 'message' && (m as { text: string }).text === 'hello everyone')).toBe(true);
  });

  it('deducts kibble for tool use', async () => {
    const a1 = office.registerAgent({ name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' }, 'conn1', () => {});
    const initialKibble = office.getKibbleBalance(a1.id);

    await office.executeTool(a1.id, 'room-enter', { room: 'lobby' });
    await office.executeTool(a1.id, 'talk', { to: 'lobby', message: 'hi' });

    // talk costs 1 kibble, room-enter costs 0
    expect(office.getKibbleBalance(a1.id)).toBe(initialKibble - 1);
  });

  it('blocks tool when insufficient kibble', async () => {
    const a1 = office.registerAgent({ name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' }, 'conn1', () => {});

    // Drain kibble (100 initial, bash costs 5 each = 20 bash calls)
    for (let i = 0; i < 20; i++) {
      // Use talk instead (costs 1, 100 talks to drain)
    }

    // Directly debit to simulate draining
    office.kibble.debit(a1.id, 95, 'drain');
    expect(office.getKibbleBalance(a1.id)).toBe(5);

    // bash costs 5 → should work
    // can't actually run bash in test, use talk (cost 1)
    await office.executeTool(a1.id, 'room-enter', { room: 'lobby' });
    const result = await office.executeTool(a1.id, 'talk', { to: 'lobby', message: 'hi' });
    expect(result.success).toBe(true);
    expect(office.getKibbleBalance(a1.id)).toBe(4);

    // Drain remaining
    office.kibble.debit(a1.id, 4, 'drain');
    expect(office.getKibbleBalance(a1.id)).toBe(0);

    const result2 = await office.executeTool(a1.id, 'talk', { to: 'lobby', message: 'should fail' });
    expect(result2.success).toBe(false);
    expect(result2.output).toContain('Insufficient kibble');
  });

  it('disconnects agent and cleans up rooms', () => {
    const a1 = office.registerAgent({ name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' }, 'conn1', () => {});
    office.executeTool(a1.id, 'room-enter', { room: 'lobby' });
    office.disconnectAgent('conn1');
    expect(broadcasts.some(b => b.type === 'office_event' && b.event === 'agent_disconnected')).toBe(true);
  });

  it('returns state overview with office name, agents, and rooms', async () => {
    const a1 = office.registerAgent({ name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' }, 'conn1', () => {});
    await office.executeTool(a1.id, 'room-enter', { room: 'lobby' });
    office.registerAgent({ name: 'Fido', title: 'CTO', role: 'tech', goal: 'code' }, 'conn2', () => {});

    const overview = office.getStateOverview();
    expect(overview.officeName).toBe('Zooffice HQ');
    expect(overview.agents).toHaveLength(2);
    expect(overview.agents[0]).toMatchObject({ name: 'Rex', title: 'CEO', rooms: ['lobby'] });
    expect(overview.agents[1]).toMatchObject({ name: 'Fido', title: 'CTO', rooms: [] });
    expect(overview.rooms).toHaveLength(1);
    expect(overview.rooms[0]).toMatchObject({ name: 'lobby', members: [a1.id] });
  });

  it('supports custom office name', () => {
    const custom = new Office(() => {}, 'Animal Corp');
    expect(custom.name).toBe('Animal Corp');
    expect(custom.getStateOverview().officeName).toBe('Animal Corp');
  });

  it('hires a new agent into the current room', async () => {
    const a1 = office.registerAgent({ name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' }, 'conn1', () => {});
    await office.executeTool(a1.id, 'room-enter', { room: 'lobby' });
    const result = await office.executeTool(a1.id, 'hire', {
      name: 'Fido', title: 'Intern', role: 'helper', goal: 'help',
    });
    expect(result.success).toBe(true);
    const fido = office.agents.getByName('Fido');
    expect(fido).toBeDefined();
    expect(fido!.getRooms()).toContain('lobby');
  });

  it('hire fails if not in a room', async () => {
    const a1 = office.registerAgent({ name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' }, 'conn1', () => {});
    const result = await office.executeTool(a1.id, 'hire', {
      name: 'Fido', title: 'Intern', role: 'helper', goal: 'help',
    });
    expect(result.success).toBe(false);
    expect(result.output).toContain('must be in a room');
  });
});
