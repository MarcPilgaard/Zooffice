import { describe, it, expect } from 'vitest';
import { AgentRegistry } from '../../../src/server/agent/agent-registry.js';

describe('AgentRegistry', () => {
  it('registers an agent with a generated id', () => {
    const registry = new AgentRegistry();
    const agent = registry.register({ name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' });
    expect(agent.id).toBeTruthy();
    expect(agent.name).toBe('Rex');
  });

  it('retrieves by id', () => {
    const registry = new AgentRegistry();
    const agent = registry.register({ name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' });
    expect(registry.get(agent.id)).toBe(agent);
  });

  it('retrieves by name', () => {
    const registry = new AgentRegistry();
    registry.register({ name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' });
    expect(registry.getByName('Rex')).toBeDefined();
    expect(registry.getByName('Nobody')).toBeUndefined();
  });

  it('removes agent', () => {
    const registry = new AgentRegistry();
    const agent = registry.register({ name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' });
    expect(registry.remove(agent.id)).toBe(true);
    expect(registry.get(agent.id)).toBeUndefined();
    expect(registry.count()).toBe(0);
  });

  it('lists all agents', () => {
    const registry = new AgentRegistry();
    registry.register({ name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' });
    registry.register({ name: 'Fido', title: 'CTO', role: 'tech', goal: 'code' });
    expect(registry.list()).toHaveLength(2);
  });
});
