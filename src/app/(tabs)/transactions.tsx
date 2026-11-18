import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  RefreshControl,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Plus, RefreshCw } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { WalletAuthService } from '@/lib/auth/walletAuth';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { EditTransactionModal } from '@/components/EditTransactionModal';
import { useTheme } from '@/theme/ThemeContext';
import { Tokens } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/colors';
import { TransactionCard } from '@/components/TransactionCard';
import type { WalletAccount, WalletTransaction } from '@/types/wallet';

export default function TransactionsScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [allAccounts, setAllAccounts] = useState<WalletAccount[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const loadLocalData = useCallback(async (organizationId: string, currentOffset = 0) => {
    try {
      const txs = await OfflineDatabase.getTransactions(organizationId, 20, currentOffset);
      const allAccs = await OfflineDatabase.getAccounts(organizationId, true);
      
      if (currentOffset === 0) {
        setTransactions(txs);
      } else {
        setTransactions((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const newTxs = txs.filter((t) => !existingIds.has(t.id));
          return [...prev, ...newTxs];
        });
      }
      
      setOffset(currentOffset + 20);
      setHasMore(txs.length === 20);
      setAllAccounts(allAccs);
      setAccounts(allAccs.filter((a) => a.is_active));
    } catch (e) {
      console.log(e);
    }
  }, []);

  const handleLoadMore = async () => {
    if (!hasMore || isFetchingMore || !orgId) return;
    setIsFetchingMore(true);
    await loadLocalData(orgId, offset);
    setIsFetchingMore(false);
  };

  useEffect(() => {
    async function init() {
      const session = await WalletAuthService.getSession();
      if (!session?.user) return;
      setUserId(session.user.id);
      const { organizationId, currency: fetchedCurrency } = await WalletAuthService.resolveUserWallet(session.user.id);
      setOrgId(organizationId);
      setCurrency(fetchedCurrency);
      await loadLocalData(organizationId);
    }
    init();
  }, [loadLocalData]);

  useFocusEffect(
    useCallback(() => {
      if (orgId) {
        loadLocalData(orgId, 0);
      }
    }, [orgId, loadLocalData])
  );

  useEffect(() => {
    if (!orgId) return;
    const unsubscribe = SyncEngine.subscribe((_count, isSyncing) => {
      if (!isSyncing) {
        loadLocalData(orgId, 0);
      }
    });
    return () => unsubscribe();
  }, [orgId, loadLocalData]);

  const handleEditTransaction = useCallback((tx: WalletTransaction) => {
    setSelectedTx(tx);
    setEditModalVisible(true);
  }, []);

  const handleDeleteConfirm = useCallback((tx: WalletTransaction) => {
    if (!orgId) return;
    Alert.alert(
      'Delete Transaction',
      `Delete ${tx.category || 'this transaction'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await OfflineDatabase.deleteTransaction(tx.id, orgId);
              await OfflineDatabase.enqueueMutation('DELETE_TRANSACTION', {
                id: tx.id,
                organization_id: tx.organization_id || orgId,
              });
              await loadLocalData(orgId, 0);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete transaction.');
            }
          },
        },
      ]
    );
  }, [orgId, loadLocalData]);

  const handleRefresh = useCallback(async () => {
    if (!orgId) return;
    setRefreshing(true);
    await SyncEngine.syncNow(orgId);
    await loadLocalData(orgId, 0);
    setRefreshing(false);
  }, [orgId, loadLocalData]);

  const filteredTransactions = transactions.filter((tx) => {
    if (filterType === 'all') return true;
    if (filterType === 'income') return tx.type === 'income';
    if (filterType === 'expense') return tx.type.startsWith('expense');
    if (filterType === 'transfer') return tx.type === 'transfer';
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Transactions</Text>
          <TouchableOpacity
            style={styles.syncButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={18} color={colors.primary} />
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
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          style={styles.listContainer}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No transactions found</Text>
            </View>
          }
          ListFooterComponent={
            isFetchingMore ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          renderItem={({ item: tx }) => (
            <TransactionCard
              tx={tx}
              accounts={allAccounts}
              onEdit={handleEditTransaction}
              onDelete={handleDeleteConfirm}
              currency={currency}
            />
          )}
        />
      </View>

      {/* Floating Add Transaction Button (FAB) at bottom-right */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => {
          setModalVisible(true);
        }}
        activeOpacity={0.85}
      >
        <Plus size={22} color={isDark ? colors.background : '#FFFFFF'} />
        <Text style={styles.fabText}>Add Transaction</Text>
      </TouchableOpacity>

      {/* Shared Add Transaction Modal */}
      <AddTransactionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={() => {
          if (orgId) loadLocalData(orgId, 0);
        }}
        orgId={orgId}
        userId={userId}
        accounts={accounts}
        currency={currency}
      />

      {/* Shared Edit Transaction Modal */}
      <EditTransactionModal
        visible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedTx(null);
        }}
        onSuccess={() => {
          if (orgId) loadLocalData(orgId, 0);
        }}
        orgId={orgId}
        userId={userId}
        accounts={allAccounts}
        transaction={selectedTx}
        currency={currency}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
      color: colors.textWhite,
    },
    syncButton: {
      backgroundColor: colors.surfaceElevated,
      padding: Tokens.spacing.sm,
      borderRadius: Tokens.radius.full,
      borderWidth: 1,
      borderColor: colors.borderGlow,
    },
    filterRow: {
      flexDirection: 'row',
      marginBottom: Tokens.spacing.md,
    },
    filterPill: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: Tokens.radius.full,
      backgroundColor: colors.surfaceElevated,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterPillText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    filterPillTextActive: {
      color: isDark ? colors.background : '#FFFFFF',
    },
    listContainer: {
      flex: 1,
    },
    emptyCard: {
      ...Tokens.card,
      backgroundColor: colors.surfaceCard,
      borderColor: colors.border,
      alignItems: 'center',
      padding: Tokens.spacing.xl,
    },
    emptyText: {
      ...Tokens.typography.body,
      color: colors.textMuted,
    },
    fabButton: {
      position: 'absolute',
      right: 20,
      bottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: Tokens.radius.full,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.45,
      shadowRadius: 10,
      elevation: 8,
      zIndex: 100,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.4)',
    },
    fabText: {
      fontSize: 15,
      fontWeight: '700',
      color: isDark ? colors.background : '#FFFFFF',
      marginLeft: 8,
    },
  });
