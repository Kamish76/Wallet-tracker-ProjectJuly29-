import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Plus, X, Filter, RefreshCw } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { WalletAuthService } from '@/lib/auth/walletAuth';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';
import { getAccountBadgeText } from '@/lib/utils/balance';
import { generateUUID } from '@/lib/utils/uuid';
import type { WalletAccount, WalletTransaction, TransactionType } from '@/types/wallet';

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadLocalData = useCallback(async (organizationId: string) => {
    const txs = await OfflineDatabase.getTransactions(organizationId, 100);
    const accs = await OfflineDatabase.getAccounts(organizationId);
    setTransactions(txs);
    setAccounts(accs);
  }, []);

  useEffect(() => {
    async function init() {
      const session = await WalletAuthService.getSession();
      if (!session?.user) return;
      setUserId(session.user.id);
      const { organizationId } = await WalletAuthService.resolveUserWallet(session.user.id);
      setOrgId(organizationId);
      await loadLocalData(organizationId);
    }
    init();
  }, [loadLocalData]);

  // 1. Subscribe to SyncEngine notifications so transactions update automatically after sync
  useEffect(() => {
    const unsubscribe = SyncEngine.subscribe((queueCount, isSyncing) => {
      if (!isSyncing && orgId) {
        loadLocalData(orgId);
      }
    });
    return () => unsubscribe();
  }, [orgId, loadLocalData]);

  // 2. Refresh data whenever user navigates back to Transactions tab
  useFocusEffect(
    useCallback(() => {
      if (orgId) {
        loadLocalData(orgId);
      }
    }, [orgId, loadLocalData])
  );

  const handleRefresh = async () => {
    if (!orgId) return;
    setRefreshing(true);
    await SyncEngine.syncNow(orgId);
    await loadLocalData(orgId);
    setRefreshing(false);
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (filterType === 'all') return true;
    if (filterType === 'income') return tx.type === 'income';
    if (filterType === 'expense') return tx.type.startsWith('expense');
    if (filterType === 'transfer') return tx.type === 'transfer';
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.container}>
        {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <TouchableOpacity
          style={styles.syncButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {(['all', 'income', 'expense', 'transfer'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterPill,
              filterType === type && styles.filterPillActive,
            ]}
            onPress={() => setFilterType(type)}
          >
            <Text
              style={[
                styles.filterPillText,
                filterType === type && styles.filterPillTextActive,
              ]}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transactions List */}
      <ScrollView
        style={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {filteredTransactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No transactions found</Text>
          </View>
        ) : (
          filteredTransactions.map((tx) => (
            <View key={tx.id} style={styles.txCard}>
              <View style={styles.txLeft}>
                <View
                  style={[
                    styles.txTypeDot,
                    {
                      backgroundColor:
                        tx.type === 'income'
                          ? Colors.income
                          : tx.type === 'transfer'
                          ? Colors.transfer
                          : Colors.expense,
                    },
                  ]}
                />
                <View>
                  <Text style={styles.txCategory}>
                    {tx.category || (tx.type === 'transfer' ? 'Transfer' : 'Uncategorized')}
                  </Text>
                  <Text style={styles.txDate}>
                    <Text style={{ color: Colors.textLight, fontWeight: '600' }}>
                      {getAccountBadgeText(tx, accounts)}
                    </Text>
                    {' • '}
                    {new Date(tx.occurred_at).toLocaleDateString()}
                    {tx.sync_status === 'pending' ? ' • (Offline Pending)' : ''}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  {
                    color:
                      tx.type === 'income'
                        ? Colors.income
                        : tx.type === 'transfer'
                        ? Colors.transfer
                        : Colors.expense,
                  },
                ]}
              >
                {tx.type === 'income' ? '+' : '-'}${Number(tx.amount).toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
      </View>

      {/* Floating Add Transaction Button (FAB) at bottom-right */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <Plus size={22} color={Colors.background} />
        <Text style={styles.fabText}>Add Transaction</Text>
      </TouchableOpacity>

      {/* Shared Add Transaction Modal */}
      <AddTransactionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={() => {
          if (orgId) loadLocalData(orgId);
        }}
        orgId={orgId}
        userId={userId}
        accounts={accounts}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Tokens.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Tokens.spacing.md,
    paddingTop: Tokens.spacing.sm,
  },
  title: {
    ...Tokens.typography.h1,
  },
  syncButton: {
    backgroundColor: Colors.surfaceElevated,
    padding: Tokens.spacing.sm,
    borderRadius: Tokens.radius.full,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: Tokens.spacing.md,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Tokens.radius.full,
    backgroundColor: Colors.surfaceElevated,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  filterPillTextActive: {
    color: Colors.background,
  },
  listContainer: {
    flex: 1,
  },
  emptyCard: {
    ...Tokens.card,
    alignItems: 'center',
    padding: Tokens.spacing.xl,
  },
  emptyText: {
    ...Tokens.typography.body,
    color: Colors.textMuted,
  },
  txCard: {
    ...Tokens.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Tokens.spacing.sm,
    paddingVertical: 14,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txTypeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Tokens.spacing.md,
  },
  txCategory: {
    ...Tokens.typography.body,
    fontWeight: '600',
  },
  txDate: {
    ...Tokens.typography.caption,
    color: Colors.textDim,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  fabButton: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: Tokens.radius.full,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  fabText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.background,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Tokens.radius.xl,
    borderTopRightRadius: Tokens.radius.xl,
    padding: Tokens.spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Tokens.spacing.lg,
  },
  modalTitle: {
    ...Tokens.typography.h2,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Tokens.spacing.md,
  },
  typeBtn: {
    flex: 0.32,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Tokens.radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textLight,
  },
  typeBtnTextActive: {
    color: Colors.background,
  },
  inputLabel: {
    ...Tokens.typography.caption,
    color: Colors.textLight,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Tokens.radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textWhite,
    paddingHorizontal: Tokens.spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  accountPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  accPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Tokens.radius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  accPillActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  accPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textLight,
  },
  accPillTextActive: {
    color: Colors.background,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: Tokens.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Tokens.spacing.lg,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
});
