import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { X, Plus, Trash2 } from 'lucide-react-native';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';
import { generateUUID } from '@/lib/utils/uuid';
import { WidgetService } from '@/lib/widget/widgetService';
import { RateLimiter, RateLimitPolicies } from '@/lib/security/rateLimiter';
import { SecurityService } from '@/lib/security/securityService';
import type { WalletAccount, WalletTransaction, TransactionType, WalletCategory } from '@/types/wallet';

interface EditTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string | null;
  userId: string | null;
  accounts: WalletAccount[];
  transaction: WalletTransaction | null;
}

export function EditTransactionModal({
  visible,
  onClose,
  onSuccess,
  orgId,
  userId,
  accounts,
  transaction,
}: EditTransactionModalProps) {
  const [txType, setTxType] = useState<TransactionType>('expense_personal');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<WalletCategory[]>([]);
  const [showCustomCatInput, setShowCustomCatInput] = useState(false);
  const [customCatName, setCustomCatName] = useState('');

  useEffect(() => {
    if (visible && orgId && transaction) {
      setTxType(transaction.type);
      setAmount(String(transaction.amount ?? ''));
      setAccountId(transaction.account_id ?? (accounts[0]?.id || ''));
      setTransferToId(transaction.transfer_to_account_id ?? '');
      setCategory(transaction.category ?? '');
      setNotes(transaction.description ?? '');
      OfflineDatabase.getCategories(orgId).then(setCategories).catch(() => {});
    } else {
      setShowCustomCatInput(false);
      setCustomCatName('');
    }
  }, [visible, transaction, accounts, orgId]);

  const filteredCategories = categories.filter((c) => {
    if (txType === 'income') return c.aliases?.includes('type:income');
    return c.aliases?.includes('type:expense');
  });

  const handleCreateCustomCategory = async () => {
    if (!orgId || !customCatName.trim()) return;
    const sanitized = SecurityService.sanitizeText(customCatName, 60).trim();
    if (!sanitized) return;

    const rateStatus = await RateLimiter.checkLimit(
      'mutation:create',
      RateLimitPolicies.MUTATION_CREATE
    );
    if (!rateStatus.allowed) {
      Alert.alert('Rate Limit Exceeded', `Please try again in ${rateStatus.retryAfterSeconds}s.`);
      return;
    }
    await RateLimiter.recordAttempt('mutation:create', RateLimitPolicies.MUTATION_CREATE);

    const normalized = sanitized.toLowerCase();
    const id = generateUUID();
    const now = new Date().toISOString();
    const newCat: WalletCategory = {
      id,
      organization_id: orgId,
      normalized_name: normalized,
      display_name: sanitized,
      aliases: [txType === 'income' ? 'type:income' : 'type:expense'],
      is_custom: true,
      created_at: now,
      updated_at: now,
      sync_status: 'pending',
    };

    await OfflineDatabase.upsertCategory(newCat, 'pending');
    await OfflineDatabase.enqueueMutation('CREATE_CATEGORY', newCat);

    if (SyncEngine.getOnlineStatus()) {
      SyncEngine.syncNow(orgId).catch(() => {});
    }

    const updatedList = await OfflineDatabase.getCategories(orgId);
    setCategories(updatedList);
    setCategory(sanitized);
    setCustomCatName('');
    setShowCustomCatInput(false);
  };

  const handleSaveTransaction = async () => {
    if (!orgId || !userId || !transaction) return;
    const amountValidation = SecurityService.validateAmount(amount, { min: 0.01 });
    if (!amountValidation.isValid) {
      Alert.alert('Invalid Amount', amountValidation.error || 'Please enter a valid amount.');
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
      const rateStatus = await RateLimiter.checkLimit(
        'mutation:create',
        RateLimitPolicies.MUTATION_CREATE
      );
      if (!rateStatus.allowed) {
        Alert.alert('Rate Limit Exceeded', `Please try again in ${rateStatus.retryAfterSeconds}s.`);
        return;
      }
      await RateLimiter.recordAttempt('mutation:create', RateLimitPolicies.MUTATION_CREATE);

      const updatedTx: WalletTransaction = {
        ...transaction,
        type: txType,
        amount: amountValidation.value,
        account_id: accountId,
        transfer_to_account_id: txType === 'transfer' ? (transferToId || null) : null,
        category: SecurityService.sanitizeText(category, 60) || null,
        description: SecurityService.sanitizeText(notes, 200) || null,
        sync_status: 'pending',
      };

      // 1. Write immediately to local SQLite for instant offline reactivity
      await OfflineDatabase.upsertTransaction(updatedTx, 'pending');

      // 2. Enqueue mutation in offline sync queue
      await OfflineDatabase.enqueueMutation('UPDATE_TRANSACTION', updatedTx);

      // 3. Trigger background sync if online
      if (SyncEngine.getOnlineStatus()) {
        SyncEngine.syncNow(orgId).catch(() => {});
      }

      // 4. Update Android home screen widget immediately
      WidgetService.refreshWidgetData(orgId || undefined).catch(() => {});

      onSuccess();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update transaction.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransaction = () => {
    if (!orgId || !transaction) return;
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const rateStatus = await RateLimiter.checkLimit(
                'mutation:create',
                RateLimitPolicies.MUTATION_CREATE
              );
              if (!rateStatus.allowed) {
                Alert.alert(
                  'Rate Limit Exceeded',
                  `Please try again in ${rateStatus.retryAfterSeconds}s.`
                );
                return;
              }
              await RateLimiter.recordAttempt('mutation:create', RateLimitPolicies.MUTATION_CREATE);

              await OfflineDatabase.deleteTransaction(transaction.id, orgId);
              await OfflineDatabase.enqueueMutation('DELETE_TRANSACTION', {
                id: transaction.id,
                organization_id: orgId,
              });

              if (SyncEngine.getOnlineStatus()) {
                SyncEngine.syncNow(orgId).catch(() => {});
              }

              WidgetService.refreshWidgetData(orgId || undefined).catch(() => {});

              onSuccess();
              onClose();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete transaction.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (!transaction) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Transaction</Text>
              <TouchableOpacity onPress={onClose}>
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
                <View style={styles.categoryPillsContainer}>
                  {filteredCategories.map((cat) => {
                    const isSelected = category === cat.display_name;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryPill,
                          isSelected && styles.categoryPillSelected,
                        ]}
                        onPress={() => setCategory(cat.display_name)}
                      >
                        <Text
                          style={[
                            styles.categoryPillText,
                            isSelected && styles.categoryPillTextSelected,
                          ]}
                        >
                          {cat.display_name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  <TouchableOpacity
                    style={styles.addCategoryPill}
                    onPress={() => setShowCustomCatInput(!showCustomCatInput)}
                  >
                    <Plus size={14} color={Colors.primary} />
                    <Text style={styles.addCategoryPillText}>+ Custom</Text>
                  </TouchableOpacity>
                </View>

                {showCustomCatInput && (
                  <View style={styles.customCategoryRow}>
                    <TextInput
                      style={styles.customCategoryInput}
                      placeholder="Enter custom category name..."
                      placeholderTextColor={Colors.textDim}
                      value={customCatName}
                      onChangeText={setCustomCatName}
                      maxLength={60}
                    />
                    <TouchableOpacity
                      style={[
                        styles.customCategoryAddBtn,
                        !customCatName.trim() && { opacity: 0.4 },
                      ]}
                      onPress={handleCreateCustomCategory}
                      disabled={!customCatName.trim()}
                    >
                      <Text style={styles.customCategoryAddBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
              onPress={handleSaveTransaction}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDeleteTransaction}
              disabled={saving}
            >
              <Trash2 size={18} color={Colors.error} style={{ marginRight: 8 }} />
              <Text style={styles.deleteButtonText}>Delete Transaction</Text>
            </TouchableOpacity>
          </ScrollView>
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
    maxHeight: '90%',
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
  deleteButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: Tokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: Tokens.spacing.sm,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.error,
  },
  categoryPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Tokens.spacing.md,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Tokens.radius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryPillSelected: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primary,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textLight,
  },
  categoryPillTextSelected: {
    color: Colors.background,
  },
  addCategoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Tokens.radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addCategoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  customCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Tokens.spacing.md,
  },
  customCategoryInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Tokens.radius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: Tokens.spacing.md,
    paddingVertical: 10,
    color: Colors.textWhite,
    fontSize: 14,
  },
  customCategoryAddBtn: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCategoryAddBtnText: {
    ...Tokens.typography.body,
    color: Colors.background,
    fontWeight: '700',
  },
});
