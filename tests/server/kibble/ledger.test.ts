import { describe, it, expect, beforeEach } from 'vitest';
import { KibbleLedger } from '../../../src/server/kibble/ledger.js';

describe('KibbleLedger', () => {
  let ledger: KibbleLedger;

  beforeEach(() => {
    ledger = new KibbleLedger();
  });

  describe('credit', () => {
    it('credits an agent', () => {
      ledger.credit('a1', 50);
      expect(ledger.balance('a1')).toBe(50);
    });

    it('accumulates credits', () => {
      ledger.credit('a1', 30);
      ledger.credit('a1', 20);
      expect(ledger.balance('a1')).toBe(50);
    });

    it('throws on non-positive amount', () => {
      expect(() => ledger.credit('a1', 0)).toThrow();
      expect(() => ledger.credit('a1', -5)).toThrow();
    });
  });

  describe('debit', () => {
    it('debits with sufficient funds', () => {
      ledger.credit('a1', 50);
      expect(ledger.debit('a1', 30)).toBe(true);
      expect(ledger.balance('a1')).toBe(20);
    });

    it('fails with insufficient funds', () => {
      ledger.credit('a1', 10);
      expect(ledger.debit('a1', 20)).toBe(false);
      expect(ledger.balance('a1')).toBe(10);
    });

    it('fails for unknown agent', () => {
      expect(ledger.debit('unknown', 5)).toBe(false);
    });

    it('throws on non-positive amount', () => {
      expect(() => ledger.debit('a1', 0)).toThrow();
    });
  });

  describe('transfer', () => {
    it('transfers between agents', () => {
      ledger.credit('a1', 100);
      ledger.credit('a2', 10);
      expect(ledger.transfer('a1', 'a2', 40)).toBe(true);
      expect(ledger.balance('a1')).toBe(60);
      expect(ledger.balance('a2')).toBe(50);
    });

    it('fails on insufficient funds', () => {
      ledger.credit('a1', 10);
      expect(ledger.transfer('a1', 'a2', 20)).toBe(false);
      expect(ledger.balance('a1')).toBe(10);
    });

    it('throws on non-positive amount', () => {
      expect(() => ledger.transfer('a1', 'a2', -1)).toThrow();
    });
  });

  describe('balance', () => {
    it('returns 0 for unknown agent', () => {
      expect(ledger.balance('unknown')).toBe(0);
    });
  });

  describe('history', () => {
    it('tracks all transactions', () => {
      ledger.credit('a1', 50);
      ledger.debit('a1', 10);
      expect(ledger.history()).toHaveLength(2);
    });

    it('filters by agent', () => {
      ledger.credit('a1', 50);
      ledger.credit('a2', 30);
      expect(ledger.history('a1')).toHaveLength(1);
    });
  });
});
