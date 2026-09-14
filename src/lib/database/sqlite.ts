import * as SQLite from 'expo-sqlite';
import {
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  type WalletAccount,
  type WalletTransaction,
  type OfflineSyncQueueItem,
  type SyncQueueAction,
  type WalletCategory,
} from '@/types/wallet';

const DB_NAME = 'orgwallet_offline.db';

export class OfflineDatabase {
  private static dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
  private static mutex: Promise<any> = Promise.resolve();

  private static async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.mutex.then(() => fn());
    this.mutex = next.catch(() => {});
    return next;
  }

  public static async getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = (async () => {
        try {
          const db = await SQLite.openDatabaseAsync(DB_NAME, {
            useNewConnection: true,
          });
          await this.initSchema(db);
          return db;
        } catch (error) {
          this.dbPromise = null;
          throw error;
        }
      })();
    }
    return this.dbPromise;
  }

  private static async initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS local_accounts (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        starting_value REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT,
        sync_status TEXT DEFAULT 'synced'
      );

      CREATE TABLE IF NOT EXISTS local_transactions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        account_id TEXT NOT NULL,
        transfer_to_account_id TEXT,
        category TEXT,
        category_id TEXT,
        description TEXT,
        created_at TEXT,
        occurred_at TEXT,
        sync_status TEXT DEFAULT 'synced'
      );

      CREATE TABLE IF NOT EXISTS offline_sync_queue (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        error TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS wallet_categories (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        aliases TEXT DEFAULT '[]',
        is_custom INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT,
        sync_status TEXT DEFAULT 'synced',
        local_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_wallet_categories_org ON wallet_categories(organization_id);
      CREATE INDEX IF NOT EXISTS idx_wallet_categories_name ON wallet_categories(organization_id, normalized_name);
      CREATE INDEX IF NOT EXISTS idx_transactions_org_date ON local_transactions(organization_id, occurred_at DESC);
    `);
  }

  // --- Clear All Local Database Data (for Login/Logout hygiene) ---
  public static async clearAllData(): Promise<void> {
    return this.withLock(async () => {
      try {
        const db = await this.getDb();
        await db.runAsync('DELETE FROM local_transactions;');
        await db.runAsync('DELETE FROM local_accounts;');
        await db.runAsync('DELETE FROM wallet_categories;');
        await db.runAsync('DELETE FROM offline_sync_queue;');
      } catch (err) {
        console.error('[OfflineDatabase] Error clearing local data:', err);
      }
    });
  }

  // --- Accounts CRUD ---
  public static async upsertAccount(account: WalletAccount, syncStatus: 'synced' | 'pending' = 'synced'): Promise<void> {
    return this.withLock(async () => {
      const db = await this.getDb();
      await db.runAsync(
        `INSERT INTO local_accounts (id, organization_id, name, starting_value, is_active, created_at, updated_at, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           starting_value = excluded.starting_value,
           is_active = excluded.is_active,
           updated_at = excluded.updated_at,
           sync_status = excluded.sync_status;`,
        [
          account.id ?? null,
          account.organization_id ?? null,
          account.name ?? null,
          account.starting_value ?? 0,
          account.is_active ? 1 : 0,
          account.created_at ?? null,
          account.updated_at ?? null,
          syncStatus ?? 'synced',
        ]
      );
    });
  }

  public static async getAccounts(organizationId: string, includeArchived = false): Promise<WalletAccount[]> {
    return this.withLock(async () => {
      const db = await this.getDb();
      const sql = includeArchived
        ? `SELECT * FROM local_accounts WHERE organization_id = ? ORDER BY is_active DESC, name ASC;`
        : `SELECT * FROM local_accounts WHERE organization_id = ? AND is_active = 1 ORDER BY name ASC;`;
      const rows = await db.getAllAsync<any>(sql, [organizationId ?? null]);
      return rows.map((r) => ({
        id: r.id,
        organization_id: r.organization_id,
        name: r.name,
        starting_value: r.starting_value,
        is_active: Boolean(r.is_active),
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
    });
  }

  public static async getAccountsWithBalances(organizationId: string, includeArchived = false): Promise<any[]> {
    return this.withLock(async () => {
      const db = await this.getDb();
      const condition = includeArchived ? '' : ' AND a.is_active = 1';
      const sql = `
        SELECT 
          a.id, a.organization_id, a.name, a.starting_value, a.is_active, a.created_at, a.updated_at,
          COALESCE(SUM(
            CASE 
              WHEN t.type = 'income' THEN ABS(t.amount)
              WHEN t.type IN ('expense_business', 'expense_personal', 'expense', 'transfer') AND t.account_id = a.id THEN -ABS(t.amount)
              WHEN t.type = 'transfer' AND t.transfer_to_account_id = a.id THEN ABS(t.amount)
              ELSE 0
            END
          ), 0) as balance_delta,
          COUNT(t.id) as transaction_count
        FROM local_accounts a
        LEFT JOIN local_transactions t 
          ON (t.account_id = a.id OR (t.type = 'transfer' AND t.transfer_to_account_id = a.id))
          AND t.organization_id = a.organization_id
        WHERE a.organization_id = ? ${condition}
        GROUP BY a.id
        ORDER BY a.is_active DESC, a.name ASC;
      `;
      const rows = await db.getAllAsync<any>(sql, [organizationId ?? null]);
      return rows.map((r) => ({
        id: r.id,
        organization_id: r.organization_id,
        name: r.name,
        starting_value: r.starting_value,
        is_active: Boolean(r.is_active),
        created_at: r.created_at,
        updated_at: r.updated_at,
        current_balance: Number(r.starting_value || 0) + Number(r.balance_delta || 0),
        transaction_count: r.transaction_count,
      }));
    });
  }
  public static async deleteAccount(id: string, organizationId: string): Promise<void> {
    return this.withLock(async () => {
      const db = await this.getDb();
      await db.runAsync(
        `DELETE FROM local_accounts WHERE id = ? AND organization_id = ?;`,
        [id ?? null, organizationId ?? null]
      );
    });
  }

  // --- TRANSACTIONS ---
  public static async getMonthlyTotals(organizationId: string, startDate: string, endDate: string) {
    return this.withLock(async () => {
      const db = await this.getDb();
      const rows = await db.getAllAsync<{ type: string; total: number }>(`
        SELECT type, SUM(amount) as total 
        FROM local_transactions 
        WHERE organization_id = ? AND occurred_at >= ? AND occurred_at <= ? 
        GROUP BY type
      `, [organizationId, startDate, endDate]);

      let income = 0;
      let expense = 0;

      for (const row of rows) {
        if (row.type === 'income') {
          income += row.total;
        } else if (row.type.startsWith('expense')) {
          expense += row.total;
        }
      }

      return { income, expense };
    });
  }

  public static async upsertTransaction(tx: WalletTransaction, syncStatus: 'synced' | 'pending' = 'synced'): Promise<void> {
    return this.withLock(async () => {
      const db = await this.getDb();
      await db.runAsync(
        `INSERT INTO local_transactions (
           id, organization_id, user_id, type, amount, account_id, transfer_to_account_id,
           category, category_id, description, created_at, occurred_at, sync_status
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           amount = excluded.amount,
           type = excluded.type,
           account_id = excluded.account_id,
           transfer_to_account_id = excluded.transfer_to_account_id,
           category = excluded.category,
           category_id = excluded.category_id,
           description = excluded.description,
           occurred_at = excluded.occurred_at,
           sync_status = excluded.sync_status;`,
        [
          tx.id ?? null,
          tx.organization_id ?? null,
          tx.user_id ?? null,
          tx.type ?? null,
          tx.amount ?? 0,
          tx.account_id ?? null,
          tx.transfer_to_account_id ?? null,
          tx.category ?? null,
          tx.category_id ?? null,
          tx.description ?? null,
          tx.created_at ?? null,
          tx.occurred_at ?? null,
          syncStatus ?? 'synced',
        ]
      );
    });
  }

  public static async getTransactions(
    organizationId: string,
    limit = 50,
    offset = 0,
    startDate?: string,
    endDate?: string
  ): Promise<WalletTransaction[]> {
    return this.withLock(async () => {
      const db = await this.getDb();
      let query = `SELECT * FROM local_transactions WHERE organization_id = ?`;
      const params: any[] = [organizationId ?? null];

      if (startDate) {
        query += ` AND occurred_at >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND occurred_at <= ?`;
        params.push(endDate);
      }

      query += ` ORDER BY occurred_at DESC, created_at DESC LIMIT ? OFFSET ?;`;
      params.push(limit ?? 50);
      params.push(offset ?? 0);

      const rows = await db.getAllAsync<any>(query, params);
      return rows.map((r) => ({
        id: r.id,
        organization_id: r.organization_id,
        user_id: r.user_id,
        type: r.type,
        amount: r.amount,
        account_id: r.account_id,
        transfer_to_account_id: r.transfer_to_account_id,
        category: r.category,
        category_id: r.category_id,
        description: r.description,
        created_at: r.created_at,
        occurred_at: r.occurred_at,
        sync_status: r.sync_status,
      }));
    });
  }

  public static async deleteTransaction(id: string, organizationId: string): Promise<void> {
    return this.withLock(async () => {
      const db = await this.getDb();
      await db.runAsync(
        `DELETE FROM local_transactions WHERE id = ? AND organization_id = ?;`,
        [id ?? null, organizationId ?? null]
      );
    });
  }

  public static async updateTransactionSyncStatus(id: string, syncStatus: 'synced' | 'pending'): Promise<void> {
    return this.withLock(async () => {
      const db = await this.getDb();
      await db.runAsync(
        `UPDATE local_transactions SET sync_status = ? WHERE id = ?;`,
        [syncStatus ?? 'synced', id ?? null]
      );
    });
  }

  // --- Categories CRUD ---
  public static async getCategories(orgId: string, type?: 'income' | 'expense'): Promise<WalletCategory[]> {
    return this.withLock(async () => {
      const db = await this.getDb();
      const rows = await db.getAllAsync<any>(
        `SELECT * FROM wallet_categories WHERE organization_id = ? ORDER BY created_at ASC;`,
        [orgId ?? null]
      );
      const categories: WalletCategory[] = (rows || []).map((r) => ({
        id: r.id,
        organization_id: r.organization_id,
        normalized_name: r.normalized_name,
        display_name: r.display_name,
        aliases: (() => {
          try {
            return JSON.parse(r.aliases || '[]');
          } catch {
            return [];
          }
        })(),
        is_custom: Boolean(r.is_custom),
        created_at: r.created_at,
        updated_at: r.updated_at,
        sync_status: r.sync_status,
        local_id: r.local_id,
      }));
      if (type) {
        const tag = type === 'income' ? 'type:income' : 'type:expense';
        return categories.filter((c) => c.aliases.includes(tag));
      }
      return categories;
    });
  }

  public static async upsertCategory(category: WalletCategory, syncStatus: 'synced' | 'pending' = 'synced'): Promise<void> {
    return this.withLock(async () => {
      const db = await this.getDb();
      const aliasesJson = JSON.stringify(category.aliases || []);
      await db.runAsync(
        `INSERT INTO wallet_categories (id, organization_id, normalized_name, display_name, aliases, is_custom, created_at, updated_at, sync_status, local_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           normalized_name = excluded.normalized_name,
           display_name = excluded.display_name,
           aliases = excluded.aliases,
           is_custom = excluded.is_custom,
           updated_at = excluded.updated_at,
           sync_status = excluded.sync_status;`,
        [
          category.id ?? null,
          category.organization_id ?? null,
          category.normalized_name ?? null,
          category.display_name ?? null,
          aliasesJson ?? '[]',
          category.is_custom ? 1 : 0,
          category.created_at ?? null,
          category.updated_at ?? null,
          syncStatus ?? 'synced',
          category.local_id ?? null,
        ]
      );
    });
  }

  public static async deleteCategory(categoryId: string, orgId: string): Promise<void> {
    return this.withLock(async () => {
      const db = await this.getDb();
      await db.runAsync(
        'DELETE FROM wallet_categories WHERE id = ? AND organization_id = ?;',
        [categoryId ?? null, orgId ?? null]
      );
    });
  }

  public static async seedDefaultCategories(orgId: string): Promise<void> {
    return this.withLock(async () => {
      const db = await this.getDb();
      const existing = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM wallet_categories WHERE organization_id = ? LIMIT 1;',
        [orgId ?? null]
      );
      if (existing && existing.length > 0) return;

      const now = new Date().toISOString();
      for (const name of DEFAULT_INCOME_CATEGORIES) {
        const id = `cat_inc_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${orgId.slice(0, 8)}`;
        const aliases = ['type:income'];
        await db.runAsync(
          `INSERT OR IGNORE INTO wallet_categories (id, organization_id, normalized_name, display_name, aliases, is_custom, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'pending');`,
          [
            id ?? null,
            orgId ?? null,
            name.toLowerCase() ?? null,
            name ?? null,
            JSON.stringify(aliases) ?? '[]',
            now,
            now,
          ]
        );
      }
      for (const name of DEFAULT_EXPENSE_CATEGORIES) {
        const id = `cat_exp_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${orgId.slice(0, 8)}`;
        const aliases = ['type:expense'];
        await db.runAsync(
          `INSERT OR IGNORE INTO wallet_categories (id, organization_id, normalized_name, display_name, aliases, is_custom, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'pending');`,
          [
            id ?? null,
            orgId ?? null,
            name.toLowerCase() ?? null,
            name ?? null,
            JSON.stringify(aliases) ?? '[]',
            now,
            now,
          ]
        );
      }
    });
  }

  // --- Offline Sync Queue CRUD ---
  public static async enqueueMutation(action: SyncQueueAction, payload: object): Promise<string> {
    return this.withLock(async () => {
      const db = await this.getDb();
      const id = `queue_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO offline_sync_queue (id, action, payload, status, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?);`,
        [id ?? null, action ?? null, JSON.stringify(payload ?? {}), now, now]
      );
      return id;
    });
  }

  public static async getPendingQueueItems(): Promise<OfflineSyncQueueItem[]> {
    return this.withLock(async () => {
      const db = await this.getDb();
      const rows = await db.getAllAsync<any>(
        `SELECT * FROM offline_sync_queue WHERE status = 'pending' OR status = 'failed' ORDER BY created_at ASC;`
      );
      return rows.map((r) => ({
        id: r.id,
        action: r.action as SyncQueueAction,
        payload: r.payload,
        status: r.status,
        error: r.error,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
    });
  }

  public static async updateQueueItemStatus(
    id: string,
    status: 'pending' | 'syncing' | 'failed' | 'synced',
    error: string | null = null
  ): Promise<void> {
    return this.withLock(async () => {
      const db = await this.getDb();
      await db.runAsync(
        `UPDATE offline_sync_queue SET status = ?, error = ?, updated_at = ? WHERE id = ?;`,
        [status ?? 'pending', error ?? null, new Date().toISOString(), id ?? null]
      );
    });
  }

  public static async deleteQueueItem(id: string): Promise<void> {
    return this.withLock(async () => {
      const db = await this.getDb();
      await db.runAsync(`DELETE FROM offline_sync_queue WHERE id = ?;`, [id ?? null]);
    });
  }

  public static async getQueueCount(): Promise<number> {
    return this.withLock(async () => {
      const db = await this.getDb();
      const result = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM offline_sync_queue WHERE status = 'pending' OR status = 'failed';`
      );
      return result?.count || 0;
    });
  }
}
