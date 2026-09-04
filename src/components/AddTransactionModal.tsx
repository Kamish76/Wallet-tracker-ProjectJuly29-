import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { X, Plus, Delete, AlertCircle } from 'lucide-react-native';

// Safely evaluates arithmetic expressions without eval()
function evaluateMathExpression(expr: string): number {
  try {
    const clean = expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/[^0-9+\-*/.]/g, '');

    if (!clean || /^[^0-9(]/.test(clean)) return 0;

    const tokens: (number | string)[] = [];
    let curNum = '';
    for (const char of clean) {
      if ('+-*/'.includes(char)) {
        if (curNum !== '') {
          tokens.push(parseFloat(curNum));
          curNum = '';
        }
        tokens.push(char);
      } else {
        curNum += char;
      }
    }
    if (curNum !== '') {
      tokens.push(parseFloat(curNum));
    }

    if (tokens.length === 0) return 0;
    if (tokens.length === 1 && typeof tokens[0] === 'number') return tokens[0];

    const pass1: (number | string)[] = [];
    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      if (token === '*' || token === '/') {
        const prev = pass1.pop() as number;
        const next = (tokens[i + 1] ?? 1) as number;
        if (token === '*') {
          pass1.push(prev * next);
        } else {
          pass1.push(next === 0 ? 0 : prev / next);
        }
        i += 2;
      } else {
        pass1.push(token);
        i++;
      }
    }

    let result = (pass1[0] as number) || 0;
    i = 1;
    while (i < pass1.length) {
      const op = pass1[i];
      const val = (pass1[i + 1] ?? 0) as number;
      if (op === '+') result += val;
      else if (op === '-') result -= val;
      i += 2;
    }

    return isNaN(result) ? 0 : Number(result.toFixed(2));
  } catch {
    return 0;
  }
}
import { OfflineDatabase } from '@/lib/database/sqlite';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';
import { generateUUID } from '@/lib/utils/uuid';
import { WidgetService } from '@/lib/widget/widgetService';
import { RateLimiter, RateLimitPolicies } from '@/lib/security/rateLimiter';
import { SecurityService } from '@/lib/security/securityService';
import { calculateAccountBalance } from '@/lib/utils/balance';
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
  const [displayExpr, setDisplayExpr] = useState('0');
  const [accountId, setAccountId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<WalletCategory[]>([]);
  const [showCustomCatInput, setShowCustomCatInput] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const [customCatName, setCustomCatName] = useState('');
  const [accountBalances, setAccountBalances] = useState<Record<string, number>>({});

  const evaluatedAmount = useMemo(() => {
    return evaluateMathExpression(displayExpr);
  }, [displayExpr]);

  const handleKeypadPress = (key: string) => {
    if (key === '=') {
      const val = evaluateMathExpression(displayExpr);
      setDisplayExpr(String(val));
      return;
    }
    if (key === 'BACKSPACE') {
      if (displayExpr.length <= 1) {
        setDisplayExpr('0');
      } else {
        setDisplayExpr(displayExpr.slice(0, -1));
      }
      return;
    }
    if (displayExpr === '0' && '0123456789'.includes(key)) {
      setDisplayExpr(key);
    } else {
      const lastChar = displayExpr.slice(-1);
      const isOp = '+-×÷.'.includes(key);
      const lastIsOp = '+-×÷.'.includes(lastChar);
      if (isOp && lastIsOp) {
        setDisplayExpr(displayExpr.slice(0, -1) + key);
      } else {
        setDisplayExpr(displayExpr + key);
      }
    }
  };

  useEffect(() => {
    if (visible && orgId) {
      if (initialType) {
        setTxType(initialType);
      }
      if (accounts.length > 0 && !accountId) {
        setAccountId(accounts[0].id);
      }
      OfflineDatabase.getCategories(orgId).then(setCategories).catch(() => {});
      OfflineDatabase.getTransactions(orgId, 10000, 0).then((allTxs) => {
        const balances: Record<string, number> = {};
        for (const acc of accounts) {
          balances[acc.id] = calculateAccountBalance(acc, allTxs).current_balance;
        }
        setAccountBalances(balances);
      }).catch(() => {});
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
    setDisplayExpr('0');
    setCategory('');
    setNotes('');
    setTransferToId('');
    setShowCustomCatInput(false);
    setCustomCatName('');
  };

  const handleAddTransaction = async () => {
    if (!orgId || !userId) return;
    const evaluatedAmount = evaluateMathExpression(displayExpr);
    if (evaluatedAmount === 0) {
      Alert.alert('Invalid Amount', 'Transaction amount cannot be 0.');
      return;
    }
    const finalAmount = Math.abs(evaluatedAmount);
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
        amount: finalAmount,
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

          <ScrollView style={[styles.formScroll, { flexShrink: 1 }]} showsVerticalScrollIndicator={true}>
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

            {/* Display Area */}
            <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={styles.displayArea}>
              <TextInput
                ref={inputRef}
                autoFocus
                showSoftInputOnFocus={false}
                caretHidden
                style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
                onKeyPress={(e) => {
                  const key = e.nativeEvent.key;
                  if (key >= '0' && key <= '9') {
                    handleKeypadPress(key);
                  } else if (key === '+' || key === '-') {
                    handleKeypadPress(key);
                  } else if (key === '*') {
                    handleKeypadPress('×');
                  } else if (key === '/') {
                    handleKeypadPress('÷');
                  } else if (key === '.') {
                    handleKeypadPress('.');
                  } else if (key === 'Enter' || key === '=') {
                    handleKeypadPress('=');
                  } else if (key === 'Backspace') {
                    handleKeypadPress('BACKSPACE');
                  }
                }}
              />
              <View style={styles.displayRow}>
                <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 12 }}>
                  <Text style={[
                    styles.displayText,
                    txType === 'income' ? { color: Colors.success } : txType === 'expense_personal' ? { color: Colors.error } : { color: Colors.offline }
                  ]}>
                    {displayExpr}
                  </Text>
                  {displayExpr.match(/[+\-×÷]/) && (
                    <Text style={styles.evalText}>= ${evaluatedAmount.toFixed(2)}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleKeypadPress('BACKSPACE')} style={styles.backspaceBtn}>
                  <Delete size={24} color={Colors.textLight} />
                </TouchableOpacity>
              </View>
              {evaluatedAmount < 0 && (
                <View style={styles.warningRow}>
                  <AlertCircle size={14} color={Colors.offline} />
                  <Text style={styles.warningText}>Negative result will be recorded as a positive value</Text>
                </View>
              )}
            </TouchableOpacity>

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
                    {a.name} • {accountBalances[a.id] < 0 ? '-' : ''}${Math.abs(accountBalances[a.id] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                        {a.name} • {accountBalances[a.id] < 0 ? '-' : ''}${Math.abs(accountBalances[a.id] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        </ScrollView>

          {/* Keypad */}
          <View style={styles.keypad}>
            {[
              ['+', '7', '8', '9'],
              ['-', '4', '5', '6'],
              ['×', '1', '2', '3'],
              ['÷', '0', '.', '='],
            ].map((row, i) => (
              <View key={i} style={styles.keypadRow}>
                {row.map((btn) => (
                  <TouchableOpacity
                    key={btn}
                    style={[
                      styles.keypadBtn,
                      ['+', '-', '×', '÷'].includes(btn) && styles.keypadBtnOp,
                      btn === '=' && styles.keypadBtnEq,
                    ]}
                    onPress={() => handleKeypadPress(btn)}
                  >
                    <Text style={[
                      styles.keypadBtnText,
                      ['+', '-', '×', '÷'].includes(btn) && styles.keypadBtnTextOp,
                      btn === '=' && styles.keypadBtnTextEq,
                    ]}>
                      {btn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
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
  formScroll: {
    flexShrink: 1,
    paddingRight: 8,
  },
  displayArea: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Tokens.radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Tokens.spacing.md,
    marginBottom: Tokens.spacing.md,
    marginTop: Tokens.spacing.xs,
  },
  displayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  displayText: {
    fontSize: 32,
    fontWeight: '300',
  },
  evalText: {
    fontSize: 14,
    color: Colors.textDim,
    marginTop: 2,
  },
  backspaceBtn: {
    padding: Tokens.spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Tokens.radius.md,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  warningText: {
    fontSize: 12,
    color: Colors.offline,
  },
  keypad: {
    marginTop: Tokens.spacing.md,
    paddingTop: Tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  keypadBtn: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    height: 54,
    borderRadius: Tokens.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  keypadBtnOp: {
    backgroundColor: Colors.surface,
  },
  keypadBtnEq: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  keypadBtnText: {
    fontSize: 22,
    fontWeight: '500',
    color: Colors.textWhite,
  },
  keypadBtnTextOp: {
    color: Colors.textLight,
  },
  keypadBtnTextEq: {
    color: Colors.background,
    fontWeight: '700',
  },
});
