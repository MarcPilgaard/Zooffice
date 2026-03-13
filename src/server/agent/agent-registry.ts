import { v4 as uuidv4 } from 'uuid';
import { Agent } from './agent.js';
import type { AgentConfig } from './types.js';

export class AgentRegistry {
  private agents = new Map<string, Agent>();

  register(config: AgentConfig): Agent {
    const id = uuidv4();
    const agent = new Agent({ id, ...config });
    this.agents.set(id, agent);
    return agent;
  }

  get(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  getByName(name: string): Agent | undefined {
    return [...this.agents.values()].find(a => a.name === name);
  }

  remove(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;
    agent.disconnect();
    return this.agents.delete(id);
  }

  list(): Agent[] {
    return [...this.agents.values()];
  }

  count(): number {
    return this.agents.size;
  }
}
