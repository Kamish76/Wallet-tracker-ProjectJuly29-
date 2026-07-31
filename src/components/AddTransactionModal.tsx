import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { X } from 'lucide-react-native';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';
import { generateUUID } from '@/lib/utils/uuid';
import { WidgetService } from '@/lib/widget/widgetService';
import type { WalletAccount, WalletTransaction, TransactionType } from '@/types/wallet';

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string | null;
  userId: string | null;
  accounts: WalletAccount[];
  initialType?: TransactionType;
}

export function AddTransactionModal({
  visible,
  onClose,
  onSuccess,
  orgId,
  userId,
  accounts,
  initialType,
}: AddTransactionModalProps) {
  const [txType, setTxType] = useState<TransactionType>('expense_personal');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (initialType) {
        setTxType(initialType);
      }
      if (accounts.length > 0 && !accountId) {
        setAccountId(accounts[0].id);
      }
    }
  }, [visible, accounts, accountId, initialType]);

  const resetForm = () => {
    setAmount('');
    setCategory('');
    setNotes('');
    setTransferToId('');
  };

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
      Alert.alert(
        'Invalid Transfer',
        'Destination account must be different from source account.'
      );
      return;
    }

    setSaving(true);
    try {
      const newTxId = generateUUID();
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

      // 4. Update Android home screen widget immediately
      WidgetService.refreshWidgetData(orgId || undefined).catch(() => {});

      resetForm();
      onSuccess();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add transaction.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Transaction</Text>
            <TouchableOpacity
              onPress={() => {
                resetForm();
                onClose();
              }}
            >
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
            {accounts.length === 0 ? (
              <Text style={{ color: Colors.textMuted, fontStyle: 'italic' }}>
                No sub-accounts found. Create one in the Accounts tab!
              </Text>
            ) : (
              accounts.map((a) => (
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
              ))
            )}
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
              {saving ? 'Saving...' : 'Save Transaction'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Tokens.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
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
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Tokens.radius.full,
    padding: 4,
    marginBottom: Tokens.spacing.md,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Tokens.radius.full,
  },
  typeBtnActive: {
    backgroundColor: Colors.primary,
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
