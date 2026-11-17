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
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Plus, Delete, AlertCircle, ChevronDown } from 'lucide-react-native';

import { evaluateMathExpression } from '@/lib/utils/math';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { Colors, type ThemeColors } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeContext';
import { Tokens } from '@/theme/tokens';
import { generateUUID } from '@/lib/utils/uuid';
import { RateLimiter, RateLimitPolicies } from '@/lib/security/rateLimiter';
import { SecurityService } from '@/lib/security/securityService';
import { WidgetService } from '@/lib/widget/widgetService';
import { formatCurrency } from '@/lib/utils/currency';
import { formatLocalDateInput, mergeDateWithOriginalTime } from '@/lib/utils/date';
import type { WalletAccount, WalletTransaction, TransactionType, WalletCategory } from '@/types/wallet';

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string | null;
  userId: string | null;
  accounts: WalletAccount[];
  initialType?: TransactionType;
  currency?: string;
}

export function AddTransactionModal({
  visible,
  onClose,
  onSuccess,
  orgId,
  userId,
  accounts,
  initialType,
  currency = 'USD',
}: AddTransactionModalProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [txType, setTxType] = useState<TransactionType>('expense_personal');
  const [displayExpr, setDisplayExpr] = useState('0');
  const [accountId, setAccountId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [txDate, setTxDate] = useState(() => formatLocalDateInput(new Date().toISOString()));
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<WalletCategory[]>([]);
  const [showCustomCatInput, setShowCustomCatInput] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const [customCatName, setCustomCatName] = useState('');
  const [accountBalances, setAccountBalances] = useState<Record<string, number>>({});
  const [showAccountDropdown, setShowAccountDropdown] = useState<'from' | 'to' | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [prevInitialType, setPrevInitialType] = useState(initialType);

  // Sync initialType without triggering a second render pass during animation
  if (initialType !== prevInitialType) {
    setPrevInitialType(initialType);
    if (initialType) setTxType(initialType);
  }

  // DEBUG LOGGING
  useEffect(() => {
    console.log('[AddTransactionModal] State changed:', {
      visible, txType, showAccountDropdown, showCategoryDropdown
    });
  }, [visible, txType, showAccountDropdown, showCategoryDropdown]);

  const leftExpanded = showAccountDropdown === 'from';
  const rightExpanded = showAccountDropdown === 'to' || showCategoryDropdown;
  const selectorExpanded = leftExpanded || rightExpanded;

  const leftColStyle = {
    flex: leftExpanded ? 1 : rightExpanded ? 0 : 1,
    opacity: rightExpanded ? 0 : 1,
    minWidth: rightExpanded ? 0 : undefined,
    overflow: 'hidden' as const,
    marginRight: selectorExpanded ? 0 : 6,
  };
  const rightColStyle = {
    flex: rightExpanded ? 1 : leftExpanded ? 0 : 1,
    opacity: leftExpanded ? 0 : 1,
    minWidth: leftExpanded ? 0 : undefined,
    overflow: 'hidden' as const,
    marginLeft: selectorExpanded ? 0 : 6,
  };

  const toggleAccountDropdown = (type: 'from' | 'to' | null) => {
    console.log('[AddTransactionModal] toggleAccountDropdown called with:', type);
    const nextState = showAccountDropdown === type ? null : type;
    setShowAccountDropdown(nextState);
    if (nextState) setShowCategoryDropdown(false);
  };

  const toggleCategoryDropdown = () => {
    console.log('[AddTransactionModal] toggleCategoryDropdown called');
    const nextState = !showCategoryDropdown;
    setShowCategoryDropdown(nextState);
    if (nextState) setShowAccountDropdown(null);
  };

  const evaluatedAmount = useMemo(() => {
    return evaluateMathExpression(displayExpr);
  }, [displayExpr]);

  const handleKeypadPress = (key: string) => {
    console.log('[AddTransactionModal] Keypad pressed:', key, 'Current display:', displayExpr);
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
    if (displayExpr === '0') {
      if ('0123456789'.includes(key)) {
        setDisplayExpr(key);
      } else if (key === '-') {
        setDisplayExpr('-');
      } else {
        setDisplayExpr('0' + key);
      }
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
    if (visible) {
      setTxDate(formatLocalDateInput(new Date().toISOString()));
      console.log(`[Perf Tracker] 'AddTransactionModal' rendering visible=true at ${new Date().toISOString()} (${Date.now()})`);
    } else {
      setShowCustomCatInput(false);
      setCustomCatName('');
      setShowAccountDropdown(null);
      setShowCategoryDropdown(false);
      setDisplayExpr('0');
      setCategory('');
      setNotes('');
      setTxDate(formatLocalDateInput(new Date().toISOString()));
      setTransferToId('');
    }
  }, [visible]);

  useEffect(() => {
    if (visible && accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].id);
    }
  }, [visible, accounts, accountId]);

  useEffect(() => {
    if (visible && orgId) {
      InteractionManager.runAfterInteractions(() => {
        console.log(`[Perf Tracker] 'AddTransactionModal' starting background data fetch after animations at ${new Date().toISOString()} (${Date.now()})`);
        OfflineDatabase.getCategories(orgId).then(setCategories).catch(() => {});
        OfflineDatabase.getAccountsWithBalances(orgId).then((accBalances) => {
          const balances: Record<string, number> = {};
          for (const b of accBalances) {
            balances[b.id] = b.current_balance;
          }
          setAccountBalances(balances);
          console.log(`[Perf Tracker] 'AddTransactionModal' finished background data fetch at ${new Date().toISOString()} (${Date.now()})`);
        }).catch(() => {});
      });
    }
  }, [visible, orgId, accounts]);

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
    setTxDate(formatLocalDateInput(new Date().toISOString()));
    setTransferToId('');
    setShowCustomCatInput(false);
    setCustomCatName('');
  };

  const handleAddTransaction = async () => {
    if (!orgId || !userId) return;
    const evaluatedAmount = evaluateMathExpression(displayExpr);
    const valValidation = SecurityService.validateAmount(Math.abs(evaluatedAmount));
    if (!valValidation.isValid) {
      Alert.alert('Invalid Amount', valValidation.error || 'Transaction amount cannot be 0.');
      return;
    }
    const finalAmount = valValidation.value;
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
    const trimmedDate = txDate.trim();
    if (trimmedDate && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      Alert.alert('Invalid Date', 'Please enter a valid date in YYYY-MM-DD format.');
      return;
    }

    setSaving(true);
    try {
      const rateStatus = await RateLimiter.checkLimit('mutation:create', RateLimitPolicies.MUTATION_CREATE);
      if (!rateStatus.allowed) {
        Alert.alert('Rate Limit Exceeded', `Too many attempts. Please try again in ${rateStatus.retryAfterSeconds}s.`);
        setSaving(false);
        return;
      }
      await RateLimiter.recordAttempt('mutation:create', RateLimitPolicies.MUTATION_CREATE);

      const newTxId = generateUUID();
      const now = new Date().toISOString();
      const occurredAt = trimmedDate ? mergeDateWithOriginalTime(trimmedDate, now) : now;
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
        occurred_at: occurredAt,
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { maxHeight: '95%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Transaction</Text>
            <TouchableOpacity
              onPress={() => {
                resetForm();
                onClose();
              }}
            >
              <X size={22} color={colors.textMuted} />
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
                    txType === 'income' ? { color: colors.income } : txType === 'expense_personal' ? { color: colors.expense } : { color: colors.offline }
                  ]}>
                    {displayExpr}
                  </Text>
                  {displayExpr.match(/[+\-×÷]/) && (
                    <Text style={styles.evalText}>= {formatCurrency(evaluatedAmount, currency)}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleKeypadPress('BACKSPACE')} onLongPress={() => setDisplayExpr('0')} style={styles.backspaceBtn}>
                  <Delete size={24} color={colors.textLight} />
                </TouchableOpacity>
              </View>
              {evaluatedAmount < 0 && (
                <View style={styles.warningRow}>
                  <AlertCircle size={14} color={colors.offline} />
                  <Text style={styles.warningText}>Negative result will be recorded as a positive value</Text>
                </View>
              )}
            </TouchableOpacity>

          <View style={{ zIndex: 100, elevation: 100, position: 'relative' }}>
            <View style={[styles.selectorsRow, { gap: 0 }]}>
            {/* LEFT SELECTOR: Account (or From Account) */}
            <View style={[styles.selectorCol, leftColStyle]}>
              <Text style={styles.selectorLabel} numberOfLines={1}>
                {txType === 'transfer' ? 'From' : 'Account'}
              </Text>
              <TouchableOpacity
                style={[styles.selectorButton, showAccountDropdown === 'from' && styles.selectorButtonActive]}
                onPress={() => toggleAccountDropdown('from')}
              >
                <Text style={styles.selectorButtonText} numberOfLines={1}>
                  {accounts.find(a => a.id === accountId)?.name || 'Select Account'}
                </Text>
                <ChevronDown size={16} color={colors.textLight} style={{ position: 'absolute', right: 12 }} />
              </TouchableOpacity>
            </View>

            {/* RIGHT SELECTOR: Category OR To Account */}
            <View style={[styles.selectorCol, rightColStyle]}>
              <Text style={styles.selectorLabel} numberOfLines={1}>
                {txType === 'transfer' ? 'To' : 'Category'}
              </Text>

              {txType === 'transfer' ? (
                <TouchableOpacity
                  style={[styles.selectorButton, showAccountDropdown === 'to' && styles.selectorButtonActive]}
                  onPress={() => toggleAccountDropdown('to')}
                >
                  <Text style={styles.selectorButtonText} numberOfLines={1}>
                    {accounts.find(a => a.id === transferToId)?.name || 'Select Account'}
                  </Text>
                  <ChevronDown size={16} color={colors.textLight} style={{ position: 'absolute', right: 12 }} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.selectorButton, showCategoryDropdown && styles.selectorButtonActive]}
                  onPress={() => toggleCategoryDropdown()}
                >
                  <Text style={styles.selectorButtonText} numberOfLines={1}>
                    {category || 'Select Category'}
                  </Text>
                  <ChevronDown size={16} color={colors.textLight} style={{ position: 'absolute', right: 12 }} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Floating Dropdown Lists */}
          {showAccountDropdown === 'from' && (
              <ScrollView style={styles.dropdownList} nestedScrollEnabled showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
                {accounts.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.dropdownItem, accountId === a.id && styles.dropdownItemActive]}
                    onPress={() => {
                      setAccountId(a.id);
                      setTimeout(() => toggleAccountDropdown(null), 50);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, accountId === a.id && styles.dropdownItemTextActive]}>
                      {a.name}
                    </Text>
                    <Text style={styles.dropdownItemSubText}>
                      {formatCurrency(accountBalances[a.id] || 0, currency)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
          )}

          {showAccountDropdown === 'to' && txType === 'transfer' && (
              <ScrollView style={styles.dropdownList} nestedScrollEnabled showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
                {accounts.filter(a => a.id !== accountId).map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.dropdownItem, transferToId === a.id && styles.dropdownItemActive]}
                    onPress={() => {
                      setTransferToId(a.id);
                      setTimeout(() => toggleAccountDropdown(null), 50);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, transferToId === a.id && styles.dropdownItemTextActive]}>
                      {a.name}
                    </Text>
                    <Text style={styles.dropdownItemSubText}>
                      {formatCurrency(accountBalances[a.id] || 0, currency)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
          )}

          {showCategoryDropdown && (
              <ScrollView style={styles.dropdownList} nestedScrollEnabled showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
                {filteredCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.dropdownItem, category === cat.display_name && styles.dropdownItemActive]}
                    onPress={() => {
                      setCategory(cat.display_name);
                      setTimeout(() => toggleCategoryDropdown(), 50);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, category === cat.display_name && styles.dropdownItemTextActive]}>
                      {cat.display_name}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.dropdownItemAdd}
                  onPress={() => {
                    setShowCustomCatInput(!showCustomCatInput);
                    setTimeout(() => toggleCategoryDropdown(), 50);
                  }}
                >
                  <Plus size={14} color={colors.primary} />
                  <Text style={styles.dropdownItemAddText}>+ Custom</Text>
                </TouchableOpacity>
              </ScrollView>
          )}
          </View>

          {showCustomCatInput && txType !== 'transfer' && (
            <View style={[styles.customCategoryRow, { marginTop: 12 }]}>
              <TextInput
                style={styles.customCategoryInput}
                placeholder="Enter custom category name..."
                placeholderTextColor={colors.textDim}
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

          <View pointerEvents={selectorExpanded ? 'none' : 'auto'}>
            <View style={styles.dateHeaderRow}>
              <Text style={styles.inputLabel}>Date</Text>
              <View style={styles.dateQuickRow}>
                <TouchableOpacity
                  style={styles.dateQuickChip}
                  onPress={() => setTxDate(formatLocalDateInput(new Date().toISOString()))}
                >
                  <Text style={styles.dateQuickChipText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateQuickChip}
                  onPress={() => {
                    const y = new Date();
                    y.setDate(y.getDate() - 1);
                    setTxDate(formatLocalDateInput(y.toISOString()));
                  }}
                >
                  <Text style={styles.dateQuickChipText}>Yesterday</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textDim}
              value={txDate}
              onChangeText={setTxDate}
              maxLength={10}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.inputLabel}>Notes (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Optional notes..."
            placeholderTextColor={colors.textDim}
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

          {/* Keypad */}
          <View style={[styles.keypad, { marginTop: 24, minHeight: 260 }]}>
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
        </ScrollView>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Tokens.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
    backgroundColor: colors.surfaceElevated,
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
    backgroundColor: colors.primary,
  },
  typeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textLight,
  },
  typeBtnTextActive: {
    color: isDark ? colors.background : '#FFFFFF',
  },
  inputLabel: {
    ...Tokens.typography.caption,
    color: colors.textLight,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: Tokens.radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textWhite,
    paddingHorizontal: Tokens.spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  accountPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  selectorsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    zIndex: 10,
  },
  selectorCol: {
    flex: 1,
    position: 'relative',
  },
  selectorLabel: {
    ...Tokens.typography.caption,
    color: colors.textLight,
    marginBottom: 6,
    textAlign: 'center',
    height: 18,
  },
  selectorButton: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: Tokens.radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  selectorButtonText: {
    fontSize: 14,
    color: colors.textWhite,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  selectorButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: Tokens.radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
    maxHeight: 250,
    overflow: 'hidden',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  dropdownItemActive: {
    backgroundColor: colors.secondary + '20',
  },
  dropdownItemText: {
    fontSize: 14,
    color: colors.textLight,
  },
  dropdownItemTextActive: {
    color: colors.secondary,
    fontWeight: '600',
  },
  dropdownItemSubText: {
    fontSize: 12,
    color: colors.textDim,
  },
  dropdownItemAdd: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dropdownItemAddText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  accPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Tokens.radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  accPillActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  accPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textLight,
  },
  accPillTextActive: {
    color: isDark ? colors.background : '#FFFFFF',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: Tokens.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Tokens.spacing.lg,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: isDark ? colors.background : '#FFFFFF',
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
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPillSelected: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primary,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textLight,
  },
  categoryPillTextSelected: {
    color: isDark ? colors.background : '#FFFFFF',
  },
  addCategoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Tokens.radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addCategoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  customCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Tokens.spacing.md,
  },
  customCategoryInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: Tokens.radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: Tokens.spacing.md,
    paddingVertical: 10,
    color: colors.textWhite,
    fontSize: 14,
  },
  customCategoryAddBtn: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCategoryAddBtnText: {
    ...Tokens.typography.body,
    color: isDark ? colors.background : '#FFFFFF',
    fontWeight: '700',
  },
  formScroll: {
    flexShrink: 1,
    paddingRight: 8,
  },
  displayArea: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: Tokens.radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textDim,
    marginTop: 2,
  },
  backspaceBtn: {
    padding: Tokens.spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: Tokens.radius.md,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  warningText: {
    fontSize: 12,
    color: colors.offline,
  },
  keypad: {
    marginTop: Tokens.spacing.md,
    paddingTop: Tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  keypadBtn: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    height: 54,
    borderRadius: Tokens.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  keypadBtnOp: {
    backgroundColor: colors.surface,
  },
  keypadBtnEq: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  keypadBtnText: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.textWhite,
  },
  keypadBtnTextOp: {
    color: colors.textLight,
  },
  keypadBtnTextEq: {
    color: isDark ? colors.background : '#FFFFFF',
    fontWeight: '700',
  },
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateQuickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateQuickChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Tokens.radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateQuickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
});
