export interface Transaction {
  from: string | null;
  to: string | null;
  amount: number;
  timestamp: number;
  reason: string;
}
