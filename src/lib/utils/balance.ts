import type { WalletAccount, WalletTransaction } from '@/types/wallet';

export interface AccountWithBalance extends WalletAccount {
  current_balance: number;
  transaction_count: number;
}

export function calculateAccountBalance(
  account: WalletAccount,
  transactions: WalletTransaction[]
): { current_balance: number; transaction_count: number } {
  let current_balance = Number(account.starting_value || 0);
  let transaction_count = 0;

  for (const tx of transactions) {
    const amt = Number(tx.amount || 0);
    if (tx.account_id === account.id) {
      transaction_count++;
      if (tx.type === 'income') {
        current_balance += amt;
      } else if (
        tx.type === 'expense_business' ||
        tx.type === 'expense_personal' ||
        tx.type === 'transfer'
      ) {
        current_balance -= amt;
      }
    }
    if (tx.transfer_to_account_id === account.id) {
      transaction_count++;
      if (tx.type === 'transfer') {
        current_balance += amt;
      }
    }
  }

  return {
    current_balance,
    transaction_count,
  };
}

export function getAccountsWithBalances(
  accounts: WalletAccount[],
  transactions: WalletTransaction[]
): AccountWithBalance[] {
  return accounts.map((acc) => {
    const { current_balance, transaction_count } = calculateAccountBalance(
      acc,
      transactions
    );
    return {
      ...acc,
      current_balance,
      transaction_count,
    };
  });
}

export function calculateTotalNetBalance(
  accounts: WalletAccount[],
  transactions: WalletTransaction[]
): number {
  return accounts
    .filter((a) => a.is_active)
    .reduce((total, acc) => {
      const { current_balance } = calculateAccountBalance(acc, transactions);
      return total + current_balance;
    }, 0);
}

export function calculateTotalIncome(transactions: WalletTransaction[]): number {
  return transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

export function calculateTotalExpense(transactions: WalletTransaction[]): number {
  return transactions
    .filter((t) => t.type === 'expense_personal' || t.type === 'expense_business')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}
