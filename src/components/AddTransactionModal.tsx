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
import { X, Plus } from 'lucide-react-native';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';
import { generateUUID } from '@/lib/utils/uuid';
import { WidgetService } from '@/lib/widget/widgetService';
import { RateLimiter, RateLimitPolicies } from '@/lib/security/rateLimiter';
import { SecurityService } from '@/lib/security/securityService';
import type { WalletAccount, WalletTransaction, TransactionType, WalletCategory } from '@/types/wallet';

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
  const [categories, setCategories] = useState<WalletCategory[]>([]);
  const [showCustomCatInput, setShowCustomCatInput] = useState(false);
  const [customCatName, setCustomCatName] = useState('');

  useEffect(() => {
    if (visible && orgId) {
      if (initialType) {
        setTxType(initialType);
      }
      if (accounts.length > 0 && !accountId) {
        setAccountId(accounts[0].id);
      }
      OfflineDatabase.getCategories(orgId).then(setCategories).catch(() => {});
    } else {
      setShowCustomCatInput(false);
      setCustomCatName('');
    }
  }, [visible, accounts, accountId, initialType, orgId]);

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

  const resetForm = () => {
    setAmount('');
    setCategory('');
    setNotes('');
    setTransferToId('');
    setShowCustomCatInput(false);
    setCustomCatName('');
  };

  const handleAddTransaction = async () => {
    if (!orgId || !userId) return;
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
      await RateLimiter.assertAllowed('mutation:create', RateLimitPolicies.MUTATION_CREATE);
      await RateLimiter.recordAttempt('mutation:create', RateLimitPolicies.MUTATION_CREATE);

      const newTxId = generateUUID();
      const now = new Date().toISOString();
      const newTx: WalletTransaction = {
        id: newTxId,
        organization_id: orgId,
        user_id: userId,
        type: txType,
        amount: amountValidation.value,
        account_id: accountId,
        transfer_to_account_id: txType === 'transfer' ? transferToId : null,
        category: SecurityService.sanitizeText(category, 60) || null,
        description: SecurityService.sanitizeText(notes, 200) || null,
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
