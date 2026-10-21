import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Image,
  Alert,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowUpRight, ArrowDownRight, RefreshCw, Plus, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { WalletAuthService } from '@/lib/auth/walletAuth';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { EditTransactionModal } from '@/components/EditTransactionModal';
import { WidgetService } from '@/lib/widget/widgetService';
import { useTheme } from '@/theme/ThemeContext';
import { Tokens } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/colors';
import * as Linking from 'expo-linking';
import { formatCurrency } from '@/lib/utils/currency';
import { TransactionCard } from '@/components/TransactionCard';
import type { WalletAccount, WalletTransaction, TransactionType } from '@/types/wallet';

export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

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
        15,
        currentOffset,
        start.toISOString(),
        end.toISOString()
      );
      
      const monthTotals = await OfflineDatabase.getMonthlyTotals(
        organizationId,
        start.toISOString(),
        end.toISOString()
      );
      setMonthlyIncome(monthTotals.income);
      setMonthlyExpense(monthTotals.expense);

      const accBalances = await OfflineDatabase.getAccountsWithBalances(organizationId);
      const computedBalance = accBalances.reduce((sum, b) => sum + (b.current_balance || 0), 0);

      setAccounts(localAccs);
      if (currentOffset === 0) {
        setTransactions(localTxs);
        setTotalNetBalance(computedBalance);
        WidgetService.refreshWidgetData(organizationId, computedBalance, currency).catch(() => {});
      } else {
        setTransactions((prev) => [...prev, ...localTxs]);
      }
      setOffset(currentOffset + localTxs.length);
      setHasMore(localTxs.length === 15);
    } catch (e) {
      console.error('[Dashboard] Error loading local SQLite data:', e);
    }
  }, [currentMonth, currency]);

  useEffect(() => {
    async function init() {
      const session = await WalletAuthService.getSession();
      if (!session) {
        router.replace('/(auth)/login');
        return;
      }
      setUserId(session.user.id);

      const { organizationId, currency: fetchedCurrency } = await WalletAuthService.resolveUserWallet(session.user.id);
      setOrgId(organizationId);
      setCurrency(fetchedCurrency);
      await loadLocalData(organizationId, undefined, 0);
    }
    init();
  }, [loadLocalData]);

  useEffect(() => {
    if (!orgId) return;

    const unsubscribe = SyncEngine.subscribe((_pending, isSyncing) => {
      if (!isSyncing) {
        WalletAuthService.getCachedCurrencyAsync().then(setCurrency).catch(() => {});
        loadLocalData(orgId, undefined, 0);
      }
    });

    return () => unsubscribe();
  }, [orgId, loadLocalData]);

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

  const handleEditTransaction = (tx: WalletTransaction) => {
    setSelectedTx(tx);
    setEditModalVisible(true);
  };

  const handleDeleteConfirm = (tx: WalletTransaction) => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await OfflineDatabase.deleteTransaction(tx.id, tx.organization_id);
              await OfflineDatabase.enqueueMutation('DELETE_TRANSACTION', { id: tx.id });
              if (orgId) {
                await loadLocalData(orgId, undefined, 0);
                WidgetService.refreshWidgetData(orgId).catch(() => {});
              }
              SyncEngine.syncNow().catch(() => {});
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete transaction.');
            }
          },
        },
      ]
    );
  };

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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
          <RefreshCw size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Hero Total Balance Card */}
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
        <View style={[styles.statCard, { borderColor: colors.income }]}>
          <View style={styles.statIconRow}>
            <Text style={styles.statLabel}>INCOME (MONTH)</Text>
            <ArrowUpRight size={18} color={colors.income} />
          </View>
          <Text style={[styles.statValue, { color: colors.income }]}>
            +{formatCurrency(monthlyIncome, currency)}
          </Text>
        </View>

        <View style={[styles.statCard, { borderColor: colors.expense }]}>
          <View style={styles.statIconRow}>
            <Text style={styles.statLabel}>EXPENSE (MONTH)</Text>
            <ArrowDownRight size={18} color={colors.expense} />
          </View>
          <Text style={[styles.statValue, { color: colors.expense }]}>
            -{formatCurrency(monthlyExpense, currency)}
          </Text>
        </View>
      </View>

      {/* Month Selector for Transactions */}
      <View style={styles.monthSelectorRow}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.monthButton}>
          <ChevronLeft size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={handleNextMonth} style={styles.monthButton}>
          <ChevronRight size={20} color={colors.primary} />
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        style={styles.container}
        contentContainerStyle={{ paddingHorizontal: Tokens.spacing.md, paddingTop: Tokens.spacing.sm, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
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
              <Plus size={16} color={isDark ? colors.background : '#FFFFFF'} />
              <Text style={styles.addTransactionButtonText}>Add Offline Transaction</Text>
            </TouchableOpacity>
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

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
      color: colors.textWhite,
    },
    subtitle: {
      ...Tokens.typography.caption,
      color: colors.textMuted,
    },
    syncButton: {
      backgroundColor: colors.surfaceElevated,
      padding: Tokens.spacing.sm,
      borderRadius: Tokens.radius.full,
      borderWidth: 1,
      borderColor: colors.borderGlow,
    },
    balanceCard: {
      ...Tokens.card,
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primary,
      borderWidth: 1.5,
      alignItems: 'center',
      paddingVertical: Tokens.spacing.xl,
      marginBottom: Tokens.spacing.lg,
      shadowColor: colors.primary,
    },
    balanceLabel: {
      ...Tokens.typography.caption,
      color: colors.primary,
      letterSpacing: 1.2,
      marginBottom: Tokens.spacing.xs,
    },
    balanceValue: {
      fontSize: 38,
      fontWeight: '800',
      color: colors.textWhite,
    },
    accountCountPill: {
      backgroundColor: isDark ? 'rgba(0, 242, 254, 0.12)' : 'rgba(2, 132, 199, 0.12)',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: Tokens.radius.full,
      marginTop: Tokens.spacing.sm,
    },
    accountCountText: {
      ...Tokens.typography.caption,
      color: colors.primaryDark,
      fontWeight: '600',
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: Tokens.spacing.lg,
    },
    statCard: {
      ...Tokens.card,
      backgroundColor: colors.surfaceCard,
      flex: 0.48,
      padding: Tokens.spacing.md,
      borderWidth: 1,
      shadowColor: isDark ? colors.primary : 'rgba(0, 0, 0, 0.06)',
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
      color: colors.textMuted,
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
      color: colors.textWhite,
    },
    seeAllText: {
      ...Tokens.typography.caption,
      color: colors.primary,
      fontWeight: '600',
    },
    emptyCard: {
      ...Tokens.card,
      backgroundColor: colors.surfaceCard,
      borderColor: colors.border,
      alignItems: 'center',
      padding: Tokens.spacing.xl,
    },
    emptyTitle: {
      ...Tokens.typography.h3,
      color: colors.textWhite,
      marginBottom: Tokens.spacing.xs,
    },
    emptySubtitle: {
      ...Tokens.typography.body,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: Tokens.spacing.lg,
    },
    addTransactionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: Tokens.spacing.lg,
      paddingVertical: 12,
      borderRadius: Tokens.radius.md,
    },
    addTransactionButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: isDark ? colors.background : '#FFFFFF',
      marginLeft: 6,
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
      backgroundColor: colors.surfaceElevated,
    },
    monthLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textWhite,
      marginHorizontal: Tokens.spacing.md,
      minWidth: 140,
      textAlign: 'center',
    },
  });
