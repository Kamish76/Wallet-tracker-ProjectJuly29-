export type WalletAccount = {
  id: string;
  organization_id: string;
  name: string;
  starting_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AccountWithBalance = WalletAccount & {
  current_balance: number;
  transaction_count: number;
};

export type TransactionType = 'income' | 'expense_personal' | 'expense_business' | 'expense' | 'transfer';

export type WalletTransaction = {
  id: string;
  organization_id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  account_id: string;
  transfer_to_account_id?: string | null;
  category?: string | null;
  category_id?: string | null;
  description?: string | null;
  created_at: string;
  occurred_at: string;
  is_initial?: boolean;
  // Local offline status flags
  sync_status?: 'synced' | 'pending' | 'syncing' | 'failed';
  local_id?: string;
};

export type Organization = {
  id: string;
  name: string;
  description?: string | null;
  owner_id: string;
  is_wallet?: boolean;
  created_at: string;
  updated_at: string;
};

export type OrganizationMember = {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export type ConflictResolutionRule = 'local_wins' | 'server_wins' | 'ask_user';

export type SyncMode = 'auto' | 'wifi_only' | 'manual';

export type SyncSettings = {
  mode: SyncMode;
  intervalMinutes: number; // e.g. 15, 360, 720, 1440
  conflictResolution: ConflictResolutionRule;
  autoSyncOnReconnect: boolean;
};

export type WalletCategory = {
  id: string;
  organization_id: string;
  normalized_name: string;
  display_name: string;
  aliases: string[]; // e.g. ['type:income'] or ['type:expense']
  is_custom: boolean;
  created_at: string;
  updated_at: string;
  // Local offline status flags
  sync_status?: 'synced' | 'pending' | 'syncing' | 'failed';
  local_id?: string;
};

export type SyncQueueAction =
  | 'CREATE_TRANSACTION'
  | 'UPDATE_TRANSACTION'
  | 'DELETE_TRANSACTION'
  | 'CREATE_ACCOUNT'
  | 'UPDATE_ACCOUNT'
  | 'ARCHIVE_ACCOUNT'
  | 'DELETE_ACCOUNT'
  | 'CREATE_CATEGORY'
  | 'UPDATE_CATEGORY'
  | 'DELETE_CATEGORY';

export type OfflineSyncQueueItem = {
  id: string;
  action: SyncQueueAction;
  payload: string; // JSON string of the mutation payload
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  error?: string | null;
  created_at: string;
  updated_at: string;
};

export type WalletTotals = {
  totalBalance: number;
  totalIncome: number;
  totalExpensePersonal: number;
  accountCount: number;
};

export const DEFAULT_INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Gifts',
  'Other Income',
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Housing',
  'Transportation',
  'Utilities',
  'Other Expense',
];
