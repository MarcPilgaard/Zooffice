import type { Transaction } from './types.js';

export class KibbleLedger {
  private balances = new Map<string, number>();
  private transactions: Transaction[] = [];

  credit(agentId: string, amount: number, reason = 'credit'): void {
    if (amount <= 0) throw new Error('Amount must be positive');
    const current = this.balances.get(agentId) ?? 0;
    this.balances.set(agentId, current + amount);
    this.transactions.push({ from: null, to: agentId, amount, timestamp: Date.now(), reason });
  }

  debit(agentId: string, amount: number, reason = 'debit'): boolean {
    if (amount <= 0) throw new Error('Amount must be positive');
    const current = this.balances.get(agentId) ?? 0;
    if (current < amount) return false;
    this.balances.set(agentId, current - amount);
    this.transactions.push({ from: agentId, to: null, amount, timestamp: Date.now(), reason });
    return true;
  }

  transfer(fromId: string, toId: string, amount: number, reason = 'transfer'): boolean {
    if (amount <= 0) throw new Error('Amount must be positive');
    const fromBalance = this.balances.get(fromId) ?? 0;
    if (fromBalance < amount) return false;
    this.balances.set(fromId, fromBalance - amount);
    const toBalance = this.balances.get(toId) ?? 0;
    this.balances.set(toId, toBalance + amount);
    this.transactions.push({ from: fromId, to: toId, amount, timestamp: Date.now(), reason });
    return true;
  }

  balance(agentId: string): number {
    return this.balances.get(agentId) ?? 0;
  }

  history(agentId?: string): Transaction[] {
    if (!agentId) return [...this.transactions];
    return this.transactions.filter(t => t.from === agentId || t.to === agentId);
  }
}
