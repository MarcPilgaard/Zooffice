import { describe, it, expect } from 'vitest';
import { Bridge, type BridgeOptions } from '../../src/client/bridge.js';

describe('Bridge', () => {
  const opts: BridgeOptions = {
    serverUrl: 'ws://localhost:9999',
    name: 'Rex',
    title: 'CEO',
    role: 'leader',
    goal: 'lead',
  };

  it('creates a bridge with options', () => {
    const bridge = new Bridge(opts);
    expect(bridge).toBeDefined();
  });

  it('disconnect is safe before connect', () => {
    const bridge = new Bridge(opts);
    expect(() => bridge.disconnect()).not.toThrow();
  });
});
