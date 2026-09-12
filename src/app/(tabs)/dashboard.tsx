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
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowUpRight, ArrowDownRight, RefreshCw, Plus, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react-native';
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
  getAccountBadgeText,
} from '@/lib/utils/balance';
import { formatCurrency } from '@/lib/utils/currency';
import { TransactionCard } from '@/components/TransactionCard';
import type { WalletAccount, WalletTransaction, TransactionType } from '@/types/wallet';

export default function DashboardScreen() {
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [totalNetBalance, setTotalNetBalance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [userId, setUserId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [initialModalTxType, setInitialModalTxType] = useState<TransactionType | undefined>(undefined);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpense, setMonthlyExpense] = useState(0);
  const deepLinkUrl = Linking.useURL();
  const { type: paramTxType } = useLocalSearchParams<{ type?: string }>();

  const getMonthStartEnd = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  };

  useEffect(() => {
    if (
      paramTxType === 'expense_personal' ||
      paramTxType === 'income' ||
      paramTxType === 'transfer'
    ) {
      setInitialModalTxType(paramTxType as TransactionType);
      setModalVisible(true);
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

  const loadLocalData = useCallback(async (organizationId: string, monthOverride?: Date, currentOffset = 0) => {
    try {
      const monthToUse = monthOverride || currentMonth;
      const { start, end } = getMonthStartEnd(monthToUse);
      
      const localAccs = await OfflineDatabase.getAccounts(organizationId);
      const localTxs = await OfflineDatabase.getTransactions(
        organizationId,
        15, // Preset to 15 per scroll
        currentOffset,
        start.toISOString(),
        end.toISOString()
      );
      
      const totals = await OfflineDatabase.getMonthlyTotals(
        organizationId,
        start.toISOString(),
        end.toISOString()
      );

      setAccounts(localAccs);
      setMonthlyIncome(totals.income);
      setMonthlyExpense(totals.expense);

      // Fetch all pre-aggregated balances to compute the true total net balance
      const accBalances = await OfflineDatabase.getAccountsWithBalances(organizationId);
      const computedBalance = accBalances.reduce((sum, b) => sum + (b.current_balance || 0), 0);
      setTotalNetBalance(computedBalance);

      if (currentOffset === 0) {
        setTransactions(localTxs);
      } else {
        setTransactions((prev) => {
          const existingIds = new Set(prev.map(t => t.id));
          const newTxs = localTxs.filter(t => !existingIds.has(t.id));
          return [...prev, ...newTxs];
        });
      }
      setOffset(currentOffset + 15);
      setHasMore(localTxs.length === 15);
    } catch (error) {
      console.error('[Dashboard] Error loading SQLite data:', error);
    }
  }, [currentMonth]); // currentMonth is in deps, which is correct, but let's decouple init

  useEffect(() => {
    async function init() {
      const session = await WalletAuthService.getSession();
      if (!session?.user) return;
      setUserId(session.user.id);
      const { organizationId, currency: fetchedCurrency } = await WalletAuthService.resolveUserWallet(session.user.id);
      setOrgId(organizationId);
      setCurrency(fetchedCurrency);
      // init is called once on mount
      await loadLocalData(organizationId, new Date());
    }
    init();
  }, []); // Remove loadLocalData dependency to prevent re-running init on month change

  // 1. Subscribe to SyncEngine notifications so transactions update automatically after sync

  const handleEditTransaction = useCallback((tx: WalletTransaction) => {
    setSelectedTx(tx);
    setEditModalVisible(true);
  }, []);

  const handleDeleteConfirm = useCallback((tx: WalletTransaction) => {
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
              await loadLocalData(orgId, undefined, 0);
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete transaction.');
            }
          },
        },
      ]
    );
  }, [orgId, loadLocalData]);

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

  const handleRefresh = useCallback(async () => {
    if (!orgId) return;
    setRefreshing(true);
    await SyncEngine.syncNow(orgId);
    await loadLocalData(orgId, undefined, 0);
    setRefreshing(false);
  }, [orgId, loadLocalData]);

  const handlePrevMonth = useCallback(() => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCurrentMonth(newMonth);
    if (orgId) loadLocalData(orgId, newMonth, 0);
  }, [currentMonth, orgId, loadLocalData]);

  const handleNextMonth = useCallback(() => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCurrentMonth(newMonth);
    if (orgId) loadLocalData(orgId, newMonth, 0);
  }, [currentMonth, orgId, loadLocalData]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isFetchingMore || !orgId) return;
    setIsFetchingMore(true);
    await loadLocalData(orgId, undefined, offset);
    setIsFetchingMore(false);
  }, [hasMore, isFetchingMore, orgId, offset, loadLocalData]);

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Total balance is now calculated accurately using all transactions in loadLocalData

  const headerElement = (
    <>
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
          {formatCurrency(totalNetBalance, currency)}
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
            <Text style={styles.statLabel}>INCOME (MONTH)</Text>
            <ArrowUpRight size={18} color={Colors.income} />
          </View>
          <Text style={[styles.statValue, { color: Colors.income }]}>
            +{formatCurrency(monthlyIncome, currency)}
          </Text>
        </View>

        <View style={[styles.statCard, { borderColor: Colors.expense }]}>
          <View style={styles.statIconRow}>
            <Text style={styles.statLabel}>EXPENSE (MONTH)</Text>
            <ArrowDownRight size={18} color={Colors.expense} />
          </View>
          <Text style={[styles.statValue, { color: Colors.expense }]}>
            -{formatCurrency(monthlyExpense, currency)}
          </Text>
        </View>
      </View>

      {/* Month Selector for Transactions */}
      <View style={styles.monthSelectorRow}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.monthButton}>
          <ChevronLeft size={20} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={handleNextMonth} style={styles.monthButton}>
          <ChevronRight size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Recent Transactions Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Transactions</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        style={styles.container}
        contentContainerStyle={{ paddingHorizontal: Tokens.spacing.md, paddingTop: Tokens.spacing.sm, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={headerElement}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
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
        }
        ListFooterComponent={
          isFetchingMore ? (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : null
        }
        renderItem={({ item: tx }) => (
          <TransactionCard
            tx={tx}
            accounts={accounts}
            onEdit={handleEditTransaction}
            onDelete={handleDeleteConfirm}
            currency={currency}
          />
        )}
      />

      {/* Floating Add Transaction Button (FAB) at bottom-right */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => {
          console.log(`[Perf Tracker] 'Add Transaction' button pressed at ${new Date().toISOString()} (${Date.now()})`);
          setModalVisible(true);
        }}
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
          if (orgId) loadLocalData(orgId, undefined, 0);
        }}
        orgId={orgId}
        userId={userId}
        accounts={accounts}
        initialType={initialModalTxType}
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
          if (orgId) loadLocalData(orgId, undefined, 0);
        }}
        orgId={orgId}
        userId={userId}
        accounts={accounts}
        transaction={selectedTx}
        currency={currency}
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
  monthSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Tokens.spacing.lg,
    marginBottom: Tokens.spacing.sm,
  },
  monthButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textWhite,
    marginHorizontal: Tokens.spacing.md,
    minWidth: 140,
    textAlign: 'center',
  },
});
