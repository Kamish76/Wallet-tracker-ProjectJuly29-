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
} from 'react-native';
import { Plus, X, Filter } from 'lucide-react-native';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { WalletAuthService } from '@/lib/auth/walletAuth';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';
import type { WalletAccount, WalletTransaction, TransactionType } from '@/types/wallet';

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Form state
  const [txType, setTxType] = useState<TransactionType>('expense_personal');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadLocalData = useCallback(async (organizationId: string) => {
    const txs = await OfflineDatabase.getTransactions(organizationId, 100);
    const accs = await OfflineDatabase.getAccounts(organizationId);
    setTransactions(txs);
    setAccounts(accs);
    if (accs.length > 0 && !accountId) {
      setAccountId(accs[0].id);
    }
  }, [accountId]);

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

  const handleAddTransaction = async () => {
    if (!orgId || !userId) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Transaction amount must be greater than 0.');
      return;
    }
    if (!accountId) {
      Alert.alert('No Account', 'Please select a wallet sub-account.');
      return;
    }
    if (txType === 'transfer' && (!transferToId || transferToId === accountId)) {
      Alert.alert('Invalid Transfer', 'Destination account must be different from source account.');
      return;
    }

    setSaving(true);
    try {
      const newTxId = `tx_local_${Date.now()}`;
      const now = new Date().toISOString();
      const newTx: WalletTransaction = {
        id: newTxId,
        organization_id: orgId,
        user_id: userId,
        type: txType,
        amount: numAmount,
        account_id: accountId,
        transfer_to_account_id: txType === 'transfer' ? transferToId : null,
        category: category.trim() || null,
        description: notes.trim() || null,
        created_at: now,
        occurred_at: now,
        sync_status: 'pending',
      };

      // 1. Write immediately to local SQLite for instant offline reactivity
      await OfflineDatabase.upsertTransaction(newTx, 'pending');

      // 2. Enqueue mutation in offline sync queue
      await OfflineDatabase.enqueueMutation('CREATE_TRANSACTION', newTx);

      // 3. Trigger background sync if online
      if (SyncEngine.getOnlineStatus()) {
        SyncEngine.syncNow(orgId);
      }

      // Reset & refresh
      setAmount('');
      setCategory('');
      setNotes('');
      setModalVisible(false);
      await loadLocalData(orgId);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to save transaction.');
    } finally {
      setSaving(false);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (filterType === 'all') return true;
    if (filterType === 'income') return tx.type === 'income';
    if (filterType === 'expense') return tx.type.startsWith('expense');
    if (filterType === 'transfer') return tx.type === 'transfer';
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Plus size={18} color={Colors.background} />
          <Text style={styles.addButtonText}>Add</Text>
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
      <ScrollView style={styles.listContainer}>
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

      {/* Offline Quick Add Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Offline Transaction</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Type Selector */}
            <View style={styles.typeSelectorRow}>
              {(
                [
                  { key: 'expense_personal', label: 'Expense' },
                  { key: 'income', label: 'Income' },
                  { key: 'transfer', label: 'Transfer' },
                ] as const
              ).map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.typeBtn,
                    txType === item.key && styles.typeBtnActive,
                  ]}
                  onPress={() => setTxType(item.key)}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      txType === item.key && styles.typeBtnTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Amount ($)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={Colors.textDim}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />

            <Text style={styles.inputLabel}>Sub-Account</Text>
            <View style={styles.accountPickerRow}>
              {accounts.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.accPill,
                    accountId === a.id && styles.accPillActive,
                  ]}
                  onPress={() => setAccountId(a.id)}
                >
                  <Text
                    style={[
                      styles.accPillText,
                      accountId === a.id && styles.accPillTextActive,
                    ]}
                  >
                    {a.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {txType === 'transfer' && (
              <>
                <Text style={styles.inputLabel}>Transfer To</Text>
                <View style={styles.accountPickerRow}>
                  {accounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <TouchableOpacity
                        key={a.id}
                        style={[
                          styles.accPill,
                          transferToId === a.id && styles.accPillActive,
                        ]}
                        onPress={() => setTransferToId(a.id)}
                      >
                        <Text
                          style={[
                            styles.accPillText,
                            transferToId === a.id && styles.accPillTextActive,
                          ]}
                        >
                          {a.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </>
            )}

            {txType !== 'transfer' && (
              <>
                <Text style={styles.inputLabel}>Category</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Groceries, Salary, Dining"
                  placeholderTextColor={Colors.textDim}
                  value={category}
                  onChangeText={setCategory}
                />
              </>
            )}

            <Text style={styles.inputLabel}>Notes (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional notes..."
              placeholderTextColor={Colors.textDim}
              value={notes}
              onChangeText={setNotes}
            />

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleAddTransaction}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save to Offline Queue'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Tokens.radius.full,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.background,
    marginLeft: 4,
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
