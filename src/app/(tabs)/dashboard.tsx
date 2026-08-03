import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowUpRight, ArrowDownRight, RefreshCw, Plus, Edit2, Trash2 } from 'lucide-react-native';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { WalletAuthService } from '@/lib/auth/walletAuth';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { EditTransactionModal } from '@/components/EditTransactionModal';
import { WidgetService } from '@/lib/widget/widgetService';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';
import * as Linking from 'expo-linking';
import {
  calculateTotalNetBalance,
  calculateTotalIncome,
  calculateTotalExpense,
  getAccountBadgeText,
} from '@/lib/utils/balance';
import type { WalletAccount, WalletTransaction, TransactionType } from '@/types/wallet';

export default function DashboardScreen() {
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [initialModalTxType, setInitialModalTxType] = useState<TransactionType | undefined>(undefined);
  const deepLinkUrl = Linking.useURL();
  const { type: paramTxType } = useLocalSearchParams<{ type?: string }>();

  const handleEditTransaction = (tx: WalletTransaction) => {
    setSelectedTx(tx);
    setEditModalVisible(true);
  };

  const handleDeleteConfirm = (tx: WalletTransaction) => {
    if (!orgId) return;
    Alert.alert(
      'Delete Transaction',
      `Delete ${tx.category || 'this transaction'} of $${Number(tx.amount).toFixed(2)}?`,
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
                organization_id: orgId,
              });
              if (SyncEngine.getOnlineStatus()) {
                SyncEngine.syncNow(orgId).catch(() => {});
              }
              WidgetService.refreshWidgetData(orgId || undefined).catch(() => {});
              await loadLocalData(orgId);
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete transaction.');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (
      paramTxType === 'expense_personal' ||
      paramTxType === 'income' ||
      paramTxType === 'transfer'
    ) {
      setInitialModalTxType(paramTxType as TransactionType);
      setModalVisible(true);
      router.setParams({ type: undefined });
    }
  }, [paramTxType]);

  useEffect(() => {
    if (!deepLinkUrl) return;
    try {
      const parsed = Linking.parse(deepLinkUrl);
      if (
        (parsed.scheme === 'orgwallet' || parsed.path?.includes('add-transaction')) &&
        parsed.queryParams?.type
      ) {
        const txTypeParam = parsed.queryParams.type as string;
        if (
          txTypeParam === 'expense_personal' ||
          txTypeParam === 'income' ||
          txTypeParam === 'transfer'
        ) {
          setInitialModalTxType(txTypeParam as TransactionType);
          setModalVisible(true);
        }
      }
    } catch (e) {
      console.log('[Dashboard] Error parsing widget deep link:', e);
    }
  }, [deepLinkUrl]);

  const loadLocalData = useCallback(async (organizationId: string) => {
    try {
      const localAccs = await OfflineDatabase.getAccounts(organizationId);
      const localTxs = await OfflineDatabase.getTransactions(organizationId, 500);
      setAccounts(localAccs);
      setTransactions(localTxs);
    } catch (error) {
      console.error('[Dashboard] Error loading SQLite data:', error);
    }
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

  // 1. Subscribe to SyncEngine notifications so Dashboard updates automatically after sync
  useEffect(() => {
    const unsubscribe = SyncEngine.subscribe((queueCount, isSyncing) => {
      if (!isSyncing && orgId) {
        loadLocalData(orgId);
      }
    });
    return () => unsubscribe();
  }, [orgId, loadLocalData]);

  // 2. Refresh data whenever user navigates back to Dashboard tab
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

  // Calculate totals from accounts & all transactions using OrgFinance web app logic
  const totalBalance = calculateTotalNetBalance(accounts, transactions);
  const totalIncome = calculateTotalIncome(transactions);
  const totalExpense = calculateTotalExpense(transactions);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.title}>Personal Wallet</Text>
            <Text style={styles.subtitle}>OrgFinance Mobile Tracker</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.syncButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Hero Total Balance Card (Neon Glow) */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>TOTAL NET BALANCE</Text>
        <Text style={styles.balanceValue}>
          ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
        <View style={styles.accountCountPill}>
          <Text style={styles.accountCountText}>
            {accounts.length} Active Sub-Account{accounts.length === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      {/* Quick Income / Expense Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: Colors.income }]}>
          <View style={styles.statIconRow}>
            <Text style={styles.statLabel}>INCOME (RECENT)</Text>
            <ArrowUpRight size={18} color={Colors.income} />
          </View>
          <Text style={[styles.statValue, { color: Colors.income }]}>
            +${totalIncome.toFixed(2)}
          </Text>
        </View>

        <View style={[styles.statCard, { borderColor: Colors.expense }]}>
          <View style={styles.statIconRow}>
            <Text style={styles.statLabel}>EXPENSE (RECENT)</Text>
            <ArrowDownRight size={18} color={Colors.expense} />
          </View>
          <Text style={[styles.statValue, { color: Colors.expense }]}>
            -${totalExpense.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Recent Transactions Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No recent transactions</Text>
          <Text style={styles.emptySubtitle}>
            Transactions added offline or synced will appear here.
          </Text>
          <TouchableOpacity
            style={styles.addTransactionButton}
            onPress={() => setModalVisible(true)}
          >
            <Plus size={16} color={Colors.background} />
            <Text style={styles.addTransactionButtonText}>Add Offline Transaction</Text>
          </TouchableOpacity>
        </View>
      ) : (
        transactions.map((tx) => (
          <TouchableOpacity
            key={tx.id}
            style={styles.txCard}
            onPress={() => handleEditTransaction(tx)}
            activeOpacity={0.7}
          >
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
            <View style={styles.txRight}>
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
              <View style={styles.txActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleEditTransaction(tx);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Edit2 size={15} color={Colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { marginLeft: 14 }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteConfirm(tx);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Trash2 size={15} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
      </ScrollView>

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
        onClose={() => {
          setModalVisible(false);
          setInitialModalTxType(undefined);
        }}
        onSuccess={() => {
          if (orgId) loadLocalData(orgId);
        }}
        orgId={orgId}
        userId={userId}
        accounts={accounts}
        initialType={initialModalTxType}
      />

      {/* Shared Edit Transaction Modal */}
      <EditTransactionModal
        visible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedTx(null);
        }}
        onSuccess={() => {
          if (orgId) loadLocalData(orgId);
        }}
        orgId={orgId}
        userId={userId}
        accounts={accounts}
        transaction={selectedTx}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Tokens.spacing.md,
    paddingBottom: Tokens.spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Tokens.spacing.lg,
    paddingTop: Tokens.spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    marginRight: 12,
  },
  title: {
    ...Tokens.typography.h1,
  },
  subtitle: {
    ...Tokens.typography.caption,
    color: Colors.textMuted,
  },
  syncButton: {
    backgroundColor: Colors.surfaceElevated,
    padding: Tokens.spacing.sm,
    borderRadius: Tokens.radius.full,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },
  balanceCard: {
    ...Tokens.card,
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.primary,
    borderWidth: 1.5,
    alignItems: 'center',
    paddingVertical: Tokens.spacing.xl,
    marginBottom: Tokens.spacing.lg,
  },
  balanceLabel: {
    ...Tokens.typography.caption,
    color: Colors.primary,
    letterSpacing: 1.2,
    marginBottom: Tokens.spacing.xs,
  },
  balanceValue: {
    fontSize: 38,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  accountCountPill: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Tokens.radius.full,
    marginTop: Tokens.spacing.sm,
  },
  accountCountText: {
    ...Tokens.typography.caption,
    color: Colors.primaryDark,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Tokens.spacing.lg,
  },
  statCard: {
    ...Tokens.card,
    flex: 0.48,
    padding: Tokens.spacing.md,
    borderWidth: 1,
  },
  statIconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Tokens.spacing.xs,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Tokens.spacing.sm,
  },
  sectionTitle: {
    ...Tokens.typography.h3,
  },
  seeAllText: {
    ...Tokens.typography.caption,
    color: Colors.primary,
  },
  emptyCard: {
    ...Tokens.card,
    alignItems: 'center',
    padding: Tokens.spacing.xl,
  },
  emptyTitle: {
    ...Tokens.typography.h3,
    marginBottom: Tokens.spacing.xs,
  },
  emptySubtitle: {
    ...Tokens.typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Tokens.spacing.lg,
  },
  addTransactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Tokens.spacing.lg,
    paddingVertical: 12,
    borderRadius: Tokens.radius.md,
  },
  addTransactionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.background,
    marginLeft: 6,
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
  txRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  txActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  actionBtn: {
    padding: 4,
  },
});
