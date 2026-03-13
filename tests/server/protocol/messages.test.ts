import { describe, it, expect } from 'vitest';
import { validateRegister, validateToolInvoke, validateTalk, validateClientMessage } from '../../../src/server/protocol/messages.js';

describe('message validation', () => {
  describe('validateRegister', () => {
    it('accepts valid register', () => {
      expect(validateRegister({ type: 'register', name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' })).toBe(true);
    });

    it('rejects empty name', () => {
      expect(validateRegister({ type: 'register', name: '', title: 'CEO', role: 'leader', goal: 'lead' })).toBe(false);
    });

    it('rejects missing fields', () => {
      expect(validateRegister({ type: 'register', name: 'Rex' })).toBe(false);
    });

    it('rejects non-object', () => {
      expect(validateRegister(null)).toBe(false);
      expect(validateRegister('string')).toBe(false);
    });
  });

  describe('validateToolInvoke', () => {
    it('accepts valid tool_invoke', () => {
      expect(validateToolInvoke({ type: 'tool_invoke', tool: 'talk', args: { to: 'a' }, requestId: 'r1' })).toBe(true);
    });

    it('rejects missing requestId', () => {
      expect(validateToolInvoke({ type: 'tool_invoke', tool: 'talk', args: {} })).toBe(false);
    });
  });

  describe('validateTalk', () => {
    it('accepts valid talk', () => {
      expect(validateTalk({ type: 'talk', to: 'lobby', message: 'hi' })).toBe(true);
    });

    it('rejects empty to', () => {
      expect(validateTalk({ type: 'talk', to: '', message: 'hi' })).toBe(false);
    });
  });

  describe('validateClientMessage', () => {
    it('validates register', () => {
      expect(validateClientMessage({ type: 'register', name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' })).toBe(true);
    });

    it('validates talk', () => {
      expect(validateClientMessage({ type: 'talk', to: 'lobby', message: 'hi' })).toBe(true);
    });

    it('rejects unknown type', () => {
      expect(validateClientMessage({ type: 'unknown' })).toBe(false);
    });
  });
});
