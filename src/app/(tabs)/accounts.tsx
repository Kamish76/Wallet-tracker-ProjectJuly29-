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
import { Plus, Archive, X, Wallet as WalletIcon, Edit2, Trash2 } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { WalletAuthService } from '@/lib/auth/walletAuth';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';
import { getAccountsWithBalances, type AccountWithBalance } from '@/lib/utils/balance';
import { generateUUID } from '@/lib/utils/uuid';
import { RateLimiter, RateLimitPolicies } from '@/lib/security/rateLimiter';
import { SecurityService } from '@/lib/security/securityService';
import type { WalletAccount, WalletTransaction } from '@/types/wallet';

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithBalance | null>(null);
  const [accName, setAccName] = useState('');
  const [startingVal, setStartingVal] = useState('0');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreateModal = () => {
    setEditingAccount(null);
    setAccName('');
    setStartingVal('0');
    setModalVisible(true);
  };

  const openEditModal = (acc: AccountWithBalance) => {
    setEditingAccount(acc);
    setAccName(acc.name);
    setStartingVal(String(acc.starting_value));
    setModalVisible(true);
  };

  const loadLocalAccounts = useCallback(async (organizationId: string, archived: boolean) => {
    const rawAccounts = await OfflineDatabase.getAccounts(organizationId, archived);
    const txs = await OfflineDatabase.getTransactions(organizationId, 500);
    const withBalances = getAccountsWithBalances(rawAccounts, txs);
    setAccounts(withBalances);
  }, []);

  useEffect(() => {
    async function init() {
      const session = await WalletAuthService.getSession();
      if (!session?.user) return;
      const { organizationId } = await WalletAuthService.resolveUserWallet(session.user.id);
      setOrgId(organizationId);
      await loadLocalAccounts(organizationId, showArchived);
    }
    init();
  }, [showArchived, loadLocalAccounts]);

  // 1. Subscribe to SyncEngine notifications so accounts update automatically after sync
  useEffect(() => {
    const unsubscribe = SyncEngine.subscribe((queueCount, isSyncing) => {
      if (!isSyncing && orgId) {
        loadLocalAccounts(orgId, showArchived);
      }
    });
    return () => unsubscribe();
  }, [orgId, showArchived, loadLocalAccounts]);

  // 2. Refresh data whenever user navigates back to Accounts tab
  useFocusEffect(
    useCallback(() => {
      if (orgId) {
        loadLocalAccounts(orgId, showArchived);
      }
    }, [orgId, showArchived, loadLocalAccounts])
  );

  const handleSaveAccount = async () => {
    if (!orgId) return;
    const sanitizedName = SecurityService.sanitizeText(accName, 50);
    if (!sanitizedName) {
      Alert.alert('Error', 'Please enter a valid account name.');
      return;
    }
    const valValidation = SecurityService.validateAmount(startingVal, { min: -100_000_000, max: 1_000_000_000 });
    if (!valValidation.isValid) {
      Alert.alert('Error', valValidation.error || 'Please enter a valid starting balance.');
      return;
    }

    const limitCheck = await RateLimiter.checkLimit('mutation:create', RateLimitPolicies.MUTATION_CREATE);
    if (!limitCheck.allowed) {
      Alert.alert('Rate Limit Exceeded', `Too many requests. Please try again in ${limitCheck.retryAfterSeconds} seconds.`);
      return;
    }
    await RateLimiter.recordAttempt('mutation:create', RateLimitPolicies.MUTATION_CREATE);

    setSaving(true);
    try {
      if (editingAccount) {
        const updatedAcc: WalletAccount = {
          id: editingAccount.id,
          organization_id: orgId,
          name: sanitizedName,
          starting_value: valValidation.value,
          is_active: editingAccount.is_active,
          created_at: editingAccount.created_at,
          updated_at: new Date().toISOString(),
        };

        await OfflineDatabase.upsertAccount(updatedAcc, 'pending');
        await OfflineDatabase.enqueueMutation('UPDATE_ACCOUNT', updatedAcc);

        if (SyncEngine.getOnlineStatus()) {
          SyncEngine.syncNow(orgId);
        }

        setModalVisible(false);
        setEditingAccount(null);
        await loadLocalAccounts(orgId, showArchived);
      } else {
        const newAcc: WalletAccount = {
          id: generateUUID(),
          organization_id: orgId,
          name: sanitizedName,
          starting_value: valValidation.value,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await OfflineDatabase.upsertAccount(newAcc, 'pending');
        await OfflineDatabase.enqueueMutation('CREATE_ACCOUNT', newAcc);

        if (SyncEngine.getOnlineStatus()) {
          SyncEngine.syncNow(orgId);
        }

        setAccName('');
        setStartingVal('0');
        setModalVisible(false);
        await loadLocalAccounts(orgId, showArchived);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save account.');
    } finally {
      setSaving(false);
    }
  };

  // Rule #2 Safeguard: Never delete an account if referenced by any transactions
  const handleDeleteAccount = (account: AccountWithBalance) => {
    if (account.transaction_count > 0) {
      Alert.alert(
        'Cannot Delete Sub-Account',
        `"${account.name}" is referenced by ${account.transaction_count} historical transaction(s) and cannot be permanently deleted. You can archive it instead.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: account.is_active ? 'Archive Sub-Account' : 'OK',
            style: 'default',
            onPress: () => {
              if (account.is_active) {
                setModalVisible(false);
                setEditingAccount(null);
                handleArchiveAccount(account);
              }
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      'Delete Sub-Account',
      `Are you sure you want to permanently delete "${account.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!orgId) return;
            setSaving(true);
            try {
              await OfflineDatabase.deleteAccount(account.id, orgId);
              await OfflineDatabase.enqueueMutation('DELETE_ACCOUNT', {
                id: account.id,
                organization_id: orgId,
              });

              if (SyncEngine.getOnlineStatus()) {
                SyncEngine.syncNow(orgId);
              }

              setModalVisible(false);
              setEditingAccount(null);
              await loadLocalAccounts(orgId, showArchived);
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete account.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  // Rule #2 Safeguard: Require Archive instead of Hard Delete
  const handleArchiveAccount = (account: WalletAccount) => {
    Alert.alert(
      'Archive Sub-Account',
      `Are you sure you want to archive "${account.name}"? Historical transactions referencing this account will be safely preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            if (!orgId) return;
            const updated = { ...account, is_active: false };
            await OfflineDatabase.upsertAccount(updated, 'pending');
            await OfflineDatabase.enqueueMutation('ARCHIVE_ACCOUNT', {
              id: account.id,
              organization_id: orgId,
            });

            if (SyncEngine.getOnlineStatus()) {
              SyncEngine.syncNow(orgId);
            }
            await loadLocalAccounts(orgId, showArchived);
          },
        },
      ]
    );
  };

  const handleUnarchiveAccount = (account: WalletAccount) => {
    Alert.alert(
      'Unarchive Sub-Account',
      `Are you sure you want to reactivate "${account.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unarchive',
          style: 'default',
          onPress: async () => {
            if (!orgId) return;
            const updated = { ...account, is_active: true };
            await OfflineDatabase.upsertAccount(updated, 'pending');
            await OfflineDatabase.enqueueMutation('UPDATE_ACCOUNT', updated);

            if (SyncEngine.getOnlineStatus()) {
              SyncEngine.syncNow(orgId);
            }
            await loadLocalAccounts(orgId, showArchived);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Wallet Sub-Accounts</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={openCreateModal}
        >
          <Plus size={18} color={Colors.background} />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Archive Toggle */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show Archived Accounts</Text>
        <TouchableOpacity
          style={[styles.toggleBtn, showArchived && styles.toggleBtnActive]}
          onPress={() => setShowArchived(!showArchived)}
        >
          <Text style={[styles.toggleBtnText, showArchived && styles.toggleBtnTextActive]}>
            {showArchived ? 'Active & Archived' : 'Active Only'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Accounts List */}
      <ScrollView style={styles.listContainer}>
        {accounts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No accounts found</Text>
          </View>
        ) : (
          accounts.map((acc) => (
            <TouchableOpacity
              key={acc.id}
              style={[styles.card, !acc.is_active && styles.cardArchived]}
              onPress={() => openEditModal(acc)}
              activeOpacity={0.7}
            >
              <View style={styles.cardLeft}>
                <View style={styles.iconBox}>
                  <WalletIcon size={20} color={acc.is_active ? Colors.primary : Colors.textDim} />
                </View>
                <View>
                  <Text style={styles.accName}>
                    {acc.name} {!acc.is_active && '(Archived)'}
                  </Text>
                  <Text style={styles.accBalanceLarge}>
                    {Number(acc.current_balance || 0) < 0 ? '-' : ''}${Math.abs(Number(acc.current_balance || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openEditModal(acc)}
                >
                  <Edit2 size={16} color={Colors.textMuted} />
                </TouchableOpacity>
                {acc.is_active && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleArchiveAccount(acc)}
                  >
                    <Archive size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Add / Edit Account Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAccount ? 'Edit Sub-Account' : 'New Sub-Account'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setEditingAccount(null);
                }}
              >
                <X size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Account Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Cash, Checking, Mobile Wallet"
              placeholderTextColor={Colors.textDim}
              value={accName}
              onChangeText={setAccName}
            />

            <Text style={styles.inputLabel}>Starting Value ($)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={Colors.textDim}
              keyboardType="decimal-pad"
              value={startingVal}
              onChangeText={setStartingVal}
            />

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveAccount}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : editingAccount ? 'Save Changes' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            {editingAccount && (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.archiveModalButton}
                  onPress={() => {
                    setModalVisible(false);
                    const acc = editingAccount;
                    setEditingAccount(null);
                    if (acc.is_active) {
                      handleArchiveAccount(acc);
                    } else {
                      handleUnarchiveAccount(acc);
                    }
                  }}
                  disabled={saving}
                >
                  <Archive size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
                  <Text style={styles.archiveModalButtonText}>
                    {editingAccount.is_active ? 'Archive Sub-Account' : 'Unarchive Sub-Account'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.deleteButton,
                    editingAccount.transaction_count > 0 && styles.deleteButtonDisabled,
                  ]}
                  onPress={() => handleDeleteAccount(editingAccount)}
                  disabled={saving}
                >
                  <Trash2 size={18} color={Colors.error} style={{ marginRight: 8 }} />
                  <Text style={styles.deleteButtonText}>Delete Sub-Account</Text>
                </TouchableOpacity>
                {editingAccount.transaction_count > 0 && (
                  <Text style={styles.safeguardHintText}>
                    Cannot delete: referenced by {editingAccount.transaction_count} transaction{editingAccount.transaction_count === 1 ? '' : 's'}. Archive instead.
                  </Text>
                )}
              </View>
            )}
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Tokens.spacing.md,
  },
  toggleLabel: {
    ...Tokens.typography.caption,
    color: Colors.textMuted,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Tokens.radius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleBtnActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  toggleBtnTextActive: {
    color: Colors.background,
  },
  listContainer: {
    flex: 1,
  },
  card: {
    ...Tokens.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Tokens.spacing.sm,
  },
  cardArchived: {
    opacity: 0.6,
    borderColor: Colors.border,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Tokens.spacing.md,
  },
  accName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accBalanceLarge: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textWhite,
    marginTop: 2,
  },
  archiveBtn: {
    padding: 8,
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
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    padding: 8,
    marginLeft: 4,
  },
  modalActions: {
    marginTop: Tokens.spacing.md,
  },
  archiveModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Tokens.radius.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Tokens.spacing.sm,
  },
  archiveModalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    borderRadius: Tokens.radius.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.3)',
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.error,
  },
  safeguardHintText: {
    ...Tokens.typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
});

