import { describe, it, expect } from 'vitest';
import { Agent } from '../../../src/server/agent/agent.js';

describe('Agent', () => {
  const identity = { id: 'a1', name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' };

  it('exposes identity fields', () => {
    const agent = new Agent(identity);
    expect(agent.id).toBe('a1');
    expect(agent.name).toBe('Rex');
    expect(agent.identity.title).toBe('CEO');
  });

  it('tracks room membership', () => {
    const agent = new Agent(identity);
    agent.joinRoom('lobby');
    expect(agent.isInRoom('lobby')).toBe(true);
    expect(agent.getRooms()).toContain('lobby');
    agent.leaveRoom('lobby');
    expect(agent.isInRoom('lobby')).toBe(false);
  });

  it('tracks connection state', () => {
    const agent = new Agent(identity);
    expect(agent.connected).toBe(true);
    agent.disconnect();
    expect(agent.connected).toBe(false);
    agent.reconnect();
    expect(agent.connected).toBe(true);
  });
});
