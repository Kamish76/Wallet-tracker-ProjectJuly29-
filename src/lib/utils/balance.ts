import type { WalletAccount, WalletTransaction } from '@/types/wallet';

export interface AccountWithBalance extends WalletAccount {
  current_balance: number;
  transaction_count: number;
}

export function getAccountBadgeText(
  tx: WalletTransaction,
  accounts: WalletAccount[]
): string {
  const fromAcc = accounts.find((a) => a.id === tx.account_id)?.name || 'Unknown Account';
  if (tx.type === 'transfer' && tx.transfer_to_account_id) {
    const toAcc = accounts.find((a) => a.id === tx.transfer_to_account_id)?.name || 'Unknown';
    return `${fromAcc} → ${toAcc}`;
  }
  return fromAcc;
}
