import { describe, it, expect } from 'vitest';
import { parseToolCalls } from '../../src/client/claude-wrapper.js';

describe('parseToolCalls', () => {
  it('parses tool call with JSON args', () => {
    const calls = parseToolCalls('--talk {"to": "lobby", "message": "hello"}');
    expect(calls).toHaveLength(1);
    expect(calls[0].tool).toBe('talk');
    expect(calls[0].args).toEqual({ to: 'lobby', message: 'hello' });
  });

  it('parses tool call without args', () => {
    const calls = parseToolCalls('--room-enter');
    expect(calls).toHaveLength(1);
    expect(calls[0].tool).toBe('room-enter');
    expect(calls[0].args).toEqual({});
  });

  it('parses multiple tool calls', () => {
    const text = `Some text
--room-enter {"room": "lobby"}
More text
--talk {"to": "lobby", "message": "hi"}`;
    const calls = parseToolCalls(text);
    expect(calls).toHaveLength(2);
    expect(calls[0].tool).toBe('room-enter');
    expect(calls[1].tool).toBe('talk');
  });

  it('returns empty for no tool calls', () => {
    expect(parseToolCalls('just regular text')).toHaveLength(0);
  });

  it('handles malformed JSON gracefully', () => {
    const calls = parseToolCalls('--talk {bad json}');
    expect(calls).toHaveLength(1);
    expect(calls[0].tool).toBe('talk');
    expect(calls[0].args).toEqual({});
  });
});
