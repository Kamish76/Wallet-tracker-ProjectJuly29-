import * as SQLite from 'expo-sqlite';
import type { WalletAccount, WalletTransaction, OfflineSyncQueueItem, SyncQueueAction } from '@/types/wallet';

const DB_NAME = 'orgwallet_offline.db';

export class OfflineDatabase {
  private static db: SQLite.SQLiteDatabase | null = null;

  public static async getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.initSchema(this.db);
    }
    return this.db;
  }

  private static async initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.execAsync(`
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
    `);
  }

  // --- Clear All Local Database Data (for Login/Logout hygiene) ---
  public static async clearAllData(): Promise<void> {
    try {
      const db = await this.getDb();
      await db.runAsync('DELETE FROM local_transactions;');
      await db.runAsync('DELETE FROM local_accounts;');
      await db.runAsync('DELETE FROM offline_sync_queue;');
    } catch (err) {
      console.error('[OfflineDatabase] Error clearing local data:', err);
    }
  }

  // --- Accounts CRUD ---
  public static async upsertAccount(account: WalletAccount, syncStatus: 'synced' | 'pending' = 'synced'): Promise<void> {
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
        account.id || null,
        account.organization_id || null,
        account.name || null,
        account.starting_value ?? 0,
        account.is_active ? 1 : 0,
        account.created_at || null,
        account.updated_at || null,
        syncStatus || 'synced',
      ]
    );
  }

  public static async getAccounts(organizationId: string, includeArchived = false): Promise<WalletAccount[]> {
    const db = await this.getDb();
    const sql = includeArchived
      ? `SELECT * FROM local_accounts WHERE organization_id = ? ORDER BY is_active DESC, name ASC;`
      : `SELECT * FROM local_accounts WHERE organization_id = ? AND is_active = 1 ORDER BY name ASC;`;
    const rows = await db.getAllAsync<any>(sql, [organizationId || null]);
    return rows.map((r) => ({
      id: r.id,
      organization_id: r.organization_id,
      name: r.name,
      starting_value: r.starting_value,
      is_active: Boolean(r.is_active),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  // --- Transactions CRUD ---
  public static async upsertTransaction(tx: WalletTransaction, syncStatus: 'synced' | 'pending' = 'synced'): Promise<void> {
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
         description = excluded.description,
         sync_status = excluded.sync_status;`,
      [
        tx.id || null,
        tx.organization_id || null,
        tx.user_id || null,
        tx.type || null,
        tx.amount ?? 0,
        tx.account_id || null,
        tx.transfer_to_account_id || null,
        tx.category || null,
        tx.category_id || null,
        tx.description || null,
        tx.created_at || null,
        tx.occurred_at || null,
        syncStatus || 'synced',
      ]
    );
  }

  public static async getTransactions(organizationId: string, limit = 50): Promise<WalletTransaction[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM local_transactions WHERE organization_id = ? ORDER BY occurred_at DESC, created_at DESC LIMIT ?;`,
      [organizationId, limit]
    );
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
  }

  // --- Offline Sync Queue CRUD ---
  public static async enqueueMutation(action: SyncQueueAction, payload: object): Promise<string> {
    const db = await this.getDb();
    const id = `queue_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO offline_sync_queue (id, action, payload, status, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?);`,
      [id || null, action || null, JSON.stringify(payload || {}), now, now]
    );
    return id;
  }

  public static async getPendingQueueItems(): Promise<OfflineSyncQueueItem[]> {
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
  }

  public static async updateQueueItemStatus(
    id: string,
    status: 'pending' | 'syncing' | 'failed' | 'synced',
    error: string | null = null
  ): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `UPDATE offline_sync_queue SET status = ?, error = ?, updated_at = ? WHERE id = ?;`,
      [status || 'pending', error || null, new Date().toISOString(), id || null]
    );
  }

  public static async deleteQueueItem(id: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(`DELETE FROM offline_sync_queue WHERE id = ?;`, [id || null]);
  }

  public static async getQueueCount(): Promise<number> {
    const db = await this.getDb();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM offline_sync_queue WHERE status = 'pending' OR status = 'failed';`
    );
    return result?.count || 0;
  }
}
