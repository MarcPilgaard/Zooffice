import { describe, it, expect } from 'vitest';
import {
  isClientMessage, isServerMessage, isBroadcastMessage,
  parseMessage, serializeMessage,
} from '../../src/shared/protocol.js';

describe('protocol', () => {
  describe('isClientMessage', () => {
    it('recognizes register', () => {
      expect(isClientMessage({ type: 'register' })).toBe(true);
    });
    it('recognizes tool_invoke', () => {
      expect(isClientMessage({ type: 'tool_invoke' })).toBe(true);
    });
    it('recognizes talk', () => {
      expect(isClientMessage({ type: 'talk' })).toBe(true);
    });
    it('rejects server messages', () => {
      expect(isClientMessage({ type: 'registered' })).toBe(false);
    });
    it('rejects non-objects', () => {
      expect(isClientMessage(null)).toBe(false);
      expect(isClientMessage('string')).toBe(false);
    });
  });

  describe('isServerMessage', () => {
    it('recognizes registered', () => {
      expect(isServerMessage({ type: 'registered' })).toBe(true);
    });
    it('recognizes message', () => {
      expect(isServerMessage({ type: 'message' })).toBe(true);
    });
    it('recognizes error', () => {
      expect(isServerMessage({ type: 'error' })).toBe(true);
    });
  });

  describe('isBroadcastMessage', () => {
    it('recognizes room_event', () => {
      expect(isBroadcastMessage({ type: 'room_event' })).toBe(true);
    });
    it('recognizes office_event', () => {
      expect(isBroadcastMessage({ type: 'office_event' })).toBe(true);
    });
  });

  describe('parseMessage', () => {
    it('parses valid JSON', () => {
      const msg = parseMessage('{"type":"register","name":"Rex"}');
      expect(msg).toMatchObject({ type: 'register', name: 'Rex' });
    });
    it('returns null for invalid JSON', () => {
      expect(parseMessage('nope')).toBeNull();
    });
    it('returns null for non-object JSON', () => {
      expect(parseMessage('"string"')).toBeNull();
    });
    it('returns null for object without type', () => {
      expect(parseMessage('{"name":"Rex"}')).toBeNull();
    });
  });

  describe('serializeMessage', () => {
    it('serializes to JSON', () => {
      const json = serializeMessage({ type: 'register', name: 'Rex', title: '', role: '', goal: '' });
      expect(JSON.parse(json)).toMatchObject({ type: 'register' });
    });
  });
});
