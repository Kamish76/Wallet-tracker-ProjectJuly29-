import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { supabaseAdmin as supabase } from '@/lib/supabase/client';
import { generateUUID, isValidUUID } from '@/lib/utils/uuid';
import { RateLimiter, RateLimitPolicies } from '@/lib/security/rateLimiter';
import { WidgetService } from '@/lib/widget/widgetService';
import type { SyncSettings, OfflineSyncQueueItem } from '@/types/wallet';

const SYNC_SETTINGS_KEY = 'orgwallet_sync_settings';

const DEFAULT_SETTINGS: SyncSettings = {
  mode: 'auto',
  intervalMinutes: 1440, // 24 hours default for maximum battery efficiency
  conflictResolution: 'local_wins',
  autoSyncOnReconnect: true,
};

type SyncListener = (queueCount: number, isSyncing: boolean) => void;

export class SyncEngine {
  private static isSyncing = false;
  private static listeners: Set<SyncListener> = new Set();
  private static isOnline = true; // Default to online; can be wired to NetInfo

  // --- Settings Management ---
  public static async getSettings(): Promise<SyncSettings> {
    try {
      const stored = await AsyncStorage.getItem(SYNC_SETTINGS_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('[SyncEngine] Failed to read sync settings:', e);
    }
    return DEFAULT_SETTINGS;
  }

  public static async updateSettings(newSettings: Partial<SyncSettings>): Promise<SyncSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...newSettings };
    await AsyncStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  }

  // --- Network State ---
  public static setNetworkStatus(online: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = online;
    if (wasOffline && online) {
      this.getSettings().then((settings) => {
        if (settings.autoSyncOnReconnect && settings.mode !== 'manual') {
          this.syncNow();
        }
      });
    }
  }

  public static getOnlineStatus(): boolean {
    return this.isOnline;
  }

  // --- Listener Subscription for Real-time UI Badge ---
  public static subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    this.notifyListeners();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static async notifyListeners(): Promise<void> {
    const count = await OfflineDatabase.getQueueCount();
    for (const l of this.listeners) {
      l(count, this.isSyncing);
    }
  }

  // --- Full Synchronization Trigger ---
  public static async syncNow(organizationId?: string): Promise<{ success: boolean; error?: string }> {
    if (this.isSyncing) {
      return { success: false, error: 'Sync already in progress' };
    }
    if (!this.isOnline) {
      return { success: false, error: 'No internet connection' };
    }

    const rateStatus = await RateLimiter.checkLimit('sync:now', RateLimitPolicies.SYNC_NOW);
    if (!rateStatus.allowed) {
      return {
        success: false,
        error: `Sync rate limit exceeded. Please wait ${rateStatus.retryAfterSeconds}s.`,
      };
    }
    await RateLimiter.recordAttempt('sync:now', RateLimitPolicies.SYNC_NOW);

    this.isSyncing = true;
    await this.notifyListeners();

    try {
      const settings = await this.getSettings();

      // Step 1: Push pending mutations to Supabase
      await this.pushPendingQueue(settings.conflictResolution);

      // Step 2: Pull latest state from Supabase if org ID provided
      if (organizationId) {
        await this.pullLatestData(organizationId);
      }

      this.isSyncing = false;
      await this.notifyListeners();
      WidgetService.refreshWidgetData(organizationId).catch(() => {});
      return { success: true };
    } catch (error: any) {
      console.error('[SyncEngine] Sync failed:', error);
      this.isSyncing = false;
      await this.notifyListeners();
      return { success: false, error: error?.message || 'Unknown sync error' };
    }
  }

  // --- First-time Auto Sync after User Login ---
  public static async firstTimeAutoSync(organizationId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isOnline) {
      console.log('[SyncEngine] Skipping firstTimeAutoSync: offline');
      return { success: false, error: 'No internet connection' };
    }
    console.log('[SyncEngine] Performing first-time auto sync after user login for org:', organizationId);
    this.isSyncing = true;
    await this.notifyListeners();

    try {
      // 1. Pull latest accounts and transactions from Supabase into SQLite first so dashboard has data immediately
      await this.pullLatestData(organizationId);

      // 2. Also push any pending local queue items if present
      const settings = await this.getSettings();
      await this.pushPendingQueue(settings.conflictResolution);

      this.isSyncing = false;
      await this.notifyListeners();
      console.log('[SyncEngine] First-time auto sync completed successfully.');
      WidgetService.refreshWidgetData(organizationId).catch(() => {});
      return { success: true };
    } catch (error: any) {
      console.error('[SyncEngine] First-time auto sync failed:', error);
      this.isSyncing = false;
      await this.notifyListeners();
      return { success: false, error: error?.message || 'Unknown sync error' };
    }
  }

  // --- Push Pending Queue ---
  private static async pushPendingQueue(conflictRule: 'local_wins' | 'server_wins' | 'ask_user'): Promise<void> {
    const items = await OfflineDatabase.getPendingQueueItems();
    for (const item of items) {
      await OfflineDatabase.updateQueueItemStatus(item.id, 'syncing');
      try {
        const payload = JSON.parse(item.payload);
        let success = false;

        if (item.action === 'CREATE_TRANSACTION') {
          // Send transaction to Supabase (sanitizing any legacy non-UUID ids to valid UUIDs or null)
          const txId = isValidUUID(payload.id) ? payload.id : generateUUID();
          const validAccountId =
            payload.account_id && isValidUUID(payload.account_id)
              ? payload.account_id
              : null;
          const validTransferToId =
            payload.transfer_to_account_id &&
            isValidUUID(payload.transfer_to_account_id)
              ? payload.transfer_to_account_id
              : null;

          const { error } = await supabase.from('transactions').insert({
            id: txId,
            organization_id: payload.organization_id,
            user_id: payload.user_id,
            type: payload.type,
            amount: payload.amount,
            account_id: validAccountId,
            transfer_to_account_id: validTransferToId,
            category: payload.category || null,
            description: payload.description || '',
            created_at: payload.created_at || new Date().toISOString(),
            occurred_at: payload.occurred_at || new Date().toISOString(),
            is_initial: false,
          });

          if (!error) success = true;
          else if (conflictRule === 'server_wins') {
            // Under server wins, if server rejects/conflicts, discard local item
            success = true;
          } else {
            throw error;
          }
        } else if (item.action === 'UPDATE_TRANSACTION') {
          const validAccountId =
            payload.account_id && isValidUUID(payload.account_id)
              ? payload.account_id
              : null;
          const validTransferToId =
            payload.transfer_to_account_id &&
            isValidUUID(payload.transfer_to_account_id)
              ? payload.transfer_to_account_id
              : null;

          const { error } = await supabase
            .from('transactions')
            .update({
              type: payload.type,
              amount: payload.amount,
              account_id: validAccountId,
              transfer_to_account_id: validTransferToId,
              category: payload.category || null,
              description: payload.description || '',
              occurred_at: payload.occurred_at || new Date().toISOString(),
            })
            .eq('id', payload.id)
            .eq('organization_id', payload.organization_id);

          if (!error) success = true;
          else if (conflictRule === 'server_wins') {
            success = true;
          } else {
            throw error;
          }
        } else if (item.action === 'DELETE_TRANSACTION') {
          const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', payload.id)
            .eq('organization_id', payload.organization_id);

          if (!error) success = true;
          else if (conflictRule === 'server_wins') {
            success = true;
          } else {
            throw error;
          }
        } else if (item.action === 'CREATE_ACCOUNT') {
          const accId = isValidUUID(payload.id) ? payload.id : generateUUID();
          const { error } = await supabase.from('wallet_accounts').insert({
            id: accId,
            organization_id: payload.organization_id,
            name: payload.name,
            starting_value: payload.starting_value,
            is_active: true,
          });
          if (!error) success = true;
          else throw error;
        } else if (item.action === 'ARCHIVE_ACCOUNT') {
          // Safeguard: archive instead of hard delete!
          const { error } = await supabase
            .from('wallet_accounts')
            .update({ is_active: false })
            .eq('id', payload.id)
            .eq('organization_id', payload.organization_id);
          if (!error) success = true;
          else throw error;
        } else if (item.action === 'UPDATE_ACCOUNT') {
          const { error } = await supabase
            .from('wallet_accounts')
            .update({
              name: payload.name,
              starting_value: payload.starting_value,
              is_active: payload.is_active ?? true,
              updated_at: payload.updated_at || new Date().toISOString(),
            })
            .eq('id', payload.id)
            .eq('organization_id', payload.organization_id);
          if (!error) success = true;
          else throw error;
        } else if (item.action === 'DELETE_ACCOUNT') {
          const { error } = await supabase
            .from('wallet_accounts')
            .delete()
            .eq('id', payload.id)
            .eq('organization_id', payload.organization_id);

          if (!error) success = true;
          else if (conflictRule === 'server_wins') {
            success = true;
          } else {
            throw error;
          }
        } else if (
          item.action === 'CREATE_CATEGORY' ||
          item.action === 'UPDATE_CATEGORY'
        ) {
          const catId = isValidUUID(payload.id) ? payload.id : generateUUID();
          const { error } = await supabase
            .from('transaction_categories')
            .upsert({
              id: catId,
              organization_id: payload.organization_id,
              normalized_name: (payload.normalized_name || '').toLowerCase(),
              aliases: payload.aliases || [],
              is_custom: Boolean(payload.is_custom),
              created_at: payload.created_at || new Date().toISOString(),
              updated_at: payload.updated_at || new Date().toISOString(),
            });
          if (!error) success = true;
          else throw error;
        } else if (item.action === 'DELETE_CATEGORY') {
          const { error } = await supabase
            .from('transaction_categories')
            .delete()
            .eq('id', payload.id)
            .eq('organization_id', payload.organization_id);
          if (!error) success = true;
          else throw error;
        }

        if (success) {
          if (item.action === 'CREATE_TRANSACTION' || item.action === 'UPDATE_TRANSACTION') {
            try {
              const payload = JSON.parse(item.payload);
              if (payload.id) {
                await OfflineDatabase.updateTransactionSyncStatus(payload.id, 'synced');
              }
            } catch {}
          }
          await OfflineDatabase.deleteQueueItem(item.id);
        }
      } catch (e: any) {
        // If error is 22P02 (invalid UUID), 23505 (duplicate key), or schema invalid syntax, remove item to prevent blocking queue without red Metro error
        if (
          e?.code === '22P02' ||
          e?.code === '23505' ||
          e?.message?.includes('invalid input syntax')
        ) {
          console.warn(`[SyncEngine] Removing un-retryable queue item ${item.id} (${e.code || e.message})`);
          await OfflineDatabase.deleteQueueItem(item.id);
        } else {
          console.error(`[SyncEngine] Failed to sync queue item ${item.id}:`, e);
          await OfflineDatabase.updateQueueItemStatus(item.id, 'failed', e?.message || 'Error');
        }
      }
    }
  }

  // --- Pull Latest Data from Supabase ---
  public static async pullLatestData(organizationId: string): Promise<void> {
    const pendingItems = await OfflineDatabase.getPendingQueueItems();
    const pendingCreateAccIds = new Set<string>();
    const pendingCreateTxIds = new Set<string>();
    const pendingCreateCatIds = new Set<string>();

    for (const item of pendingItems) {
      try {
        const payload = JSON.parse(item.payload);
        if ((item.action === 'CREATE_ACCOUNT' || item.action === 'UPDATE_ACCOUNT') && payload.id) {
          pendingCreateAccIds.add(payload.id);
        } else if (item.action === 'CREATE_TRANSACTION' && payload.id) {
          pendingCreateTxIds.add(payload.id);
        } else if (item.action === 'CREATE_CATEGORY' && payload.id) {
          pendingCreateCatIds.add(payload.id);
        }
      } catch {}
    }

    // 1. Fetch accounts
    const { data: accounts, error: accErr } = await supabase
      .from('wallet_accounts')
      .select('*')
      .eq('organization_id', organizationId);

    if (!accErr && accounts) {
      const serverAccIds = new Set(accounts.map((a) => a.id));
      const localAccs = await OfflineDatabase.getAccounts(organizationId, true);
      for (const localAcc of localAccs) {
        if (!serverAccIds.has(localAcc.id) && !pendingCreateAccIds.has(localAcc.id)) {
          await OfflineDatabase.deleteAccount(localAcc.id, organizationId);
        }
      }
      for (const acc of accounts) {
        await OfflineDatabase.upsertAccount({
          id: acc.id,
          organization_id: acc.organization_id,
          name: acc.name,
          starting_value: Number(acc.starting_value || 0),
          is_active: Boolean(acc.is_active),
          created_at: acc.created_at,
          updated_at: acc.updated_at,
        }, 'synced');
      }
    }

    // 2. Fetch transactions (increased limit to 1000 to ensure deleted records are caught)
    const { data: txs, error: txErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('organization_id', organizationId)
      .order('occurred_at', { ascending: false })
      .limit(1000);

    if (!txErr && txs) {
      const serverIds = new Set(txs.map((t) => t.id));
      const localTxs = await OfflineDatabase.getTransactions(organizationId, 1000);
      for (const localTx of localTxs) {
        // Remove ANY local transaction that does not exist on the server AND is not pending creation offline
        if (!serverIds.has(localTx.id) && !pendingCreateTxIds.has(localTx.id)) {
          await OfflineDatabase.deleteTransaction(localTx.id, organizationId);
        }
      }
      for (const tx of txs) {
        await OfflineDatabase.upsertTransaction({
          id: tx.id,
          organization_id: tx.organization_id,
          user_id: tx.user_id,
          type: tx.type as any,
          amount: Number(tx.amount || 0),
          account_id: tx.account_id,
          transfer_to_account_id: tx.transfer_to_account_id,
          category: tx.category,
          category_id: tx.category_id,
          description: tx.description,
          created_at: tx.created_at,
          occurred_at: tx.occurred_at,
        }, 'synced');
      }
    }

    // 3. Fetch transaction categories
    const { data: categories, error: catErr } = await supabase
      .from('transaction_categories')
      .select('*')
      .eq('organization_id', organizationId);

    if (!catErr && categories) {
      const serverCatIds = new Set(categories.map((c) => c.id));
      const localCats = await OfflineDatabase.getCategories(organizationId);
      for (const localCat of localCats) {
        if (
          localCat.is_custom &&
          !serverCatIds.has(localCat.id) &&
          !pendingCreateCatIds.has(localCat.id)
        ) {
          await OfflineDatabase.deleteCategory(localCat.id, organizationId);
        }
      }
      for (const cat of categories) {
        const words = (cat.normalized_name || '')
          .split(' ')
          .map((w: string) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
          .join(' ');
        await OfflineDatabase.upsertCategory(
          {
            id: cat.id,
            organization_id: cat.organization_id,
            normalized_name: cat.normalized_name,
            display_name: words,
            aliases: cat.aliases || [],
            is_custom: Boolean(cat.is_custom),
            created_at: cat.created_at,
            updated_at: cat.updated_at,
          },
          'synced'
        );
      }
    }
  }
}
