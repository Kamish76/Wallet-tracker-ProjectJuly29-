import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { supabaseAdmin as supabase } from '@/lib/supabase/client';
import { generateUUID, isValidUUID } from '@/lib/utils/uuid';
import type { SyncSettings, OfflineSyncQueueItem } from '@/types/wallet';

const SYNC_SETTINGS_KEY = 'orgwallet_sync_settings';

const DEFAULT_SETTINGS: SyncSettings = {
  mode: 'auto',
  intervalMinutes: 15,
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
      return { success: true };
    } catch (error: any) {
      console.error('[SyncEngine] Sync failed:', error);
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
          // Send transaction to Supabase
          const txId = isValidUUID(payload.id) ? payload.id : generateUUID();
          const { error } = await supabase.from('transactions').insert({
            id: txId,
            organization_id: payload.organization_id,
            user_id: payload.user_id,
            type: payload.type,
            amount: payload.amount,
            account_id: payload.account_id,
            transfer_to_account_id: payload.transfer_to_account_id || null,
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
        }

        if (success) {
          await OfflineDatabase.deleteQueueItem(item.id);
        }
      } catch (e: any) {
        console.error(`[SyncEngine] Failed to sync queue item ${item.id}:`, e);
        // If error is 22P02 (invalid UUID), 23505 (duplicate key), or schema invalid syntax, remove item to prevent blocking queue
        if (
          e?.code === '22P02' ||
          e?.code === '23505' ||
          e?.message?.includes('invalid input syntax')
        ) {
          console.warn(`[SyncEngine] Removing un-retryable queue item ${item.id} (${e.code || e.message})`);
          await OfflineDatabase.deleteQueueItem(item.id);
        } else {
          await OfflineDatabase.updateQueueItemStatus(item.id, 'failed', e?.message || 'Error');
        }
      }
    }
  }

  // --- Pull Latest Data from Supabase ---
  public static async pullLatestData(organizationId: string): Promise<void> {
    // 1. Fetch accounts
    const { data: accounts, error: accErr } = await supabase
      .from('wallet_accounts')
      .select('*')
      .eq('organization_id', organizationId);

    if (!accErr && accounts) {
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

    // 2. Fetch transactions
    const { data: txs, error: txErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('organization_id', organizationId)
      .order('occurred_at', { ascending: false })
      .limit(100);

    if (!txErr && txs) {
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
  }
}
