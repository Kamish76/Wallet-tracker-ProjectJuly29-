import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Plus, Archive, X, Wallet as WalletIcon, Edit2, Trash2, Link2 } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { WalletAuthService } from '@/lib/auth/walletAuth';
import { WidgetService } from '@/lib/widget/widgetService';
import { useTheme } from '@/theme/ThemeContext';
import { Tokens } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/colors';
import { generateUUID } from '@/lib/utils/uuid';
import { formatCurrency } from '@/lib/utils/currency';
import { RateLimiter, RateLimitPolicies } from '@/lib/security/rateLimiter';
import { SecurityService } from '@/lib/security/securityService';
import type { WalletAccount } from '@/types/wallet';
import type { AccountWithBalance } from '@/lib/utils/balance';

export default function AccountsScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithBalance | null>(null);
  const [accName, setAccName] = useState('');
  const [startingVal, setStartingVal] = useState('0');
  const [selectedLinkedOrgId, setSelectedLinkedOrgId] = useState<string | null>(null);
  const [linkableOrgs, setLinkableOrgs] = useState<{ id: string; name: string }[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const openCreateModal = () => {
    setEditingAccount(null);
    setAccName('');
    setStartingVal('0');
    setSelectedLinkedOrgId(null);
    setModalVisible(true);
  };

  const openEditModal = (acc: AccountWithBalance) => {
    setEditingAccount(acc);
    setAccName(acc.name);
    setStartingVal(String(acc.starting_value));
    setSelectedLinkedOrgId(acc.linked_org_id ?? null);
    setModalVisible(true);
  };

  const loadLocalAccounts = useCallback(async (organizationId: string, archived: boolean) => {
    const withBalances = await OfflineDatabase.getAccountsWithBalances(organizationId, archived);
    setAccounts(withBalances);
    setIsLoading(false);
    WidgetService.refreshWidgetData(organizationId).catch(() => {});
  }, []);

  useEffect(() => {
    async function init() {
      const session = await WalletAuthService.getSession();
      if (!session?.user) return;
      const { organizationId, currency: fetchedCurrency } = await WalletAuthService.resolveUserWallet(session.user.id);
      setOrgId(organizationId);
      setCurrency(fetchedCurrency);
      WalletAuthService.getLinkableOrganizations(session.user.id, organizationId)
        .then(setLinkableOrgs)
        .catch(() => {});
      await loadLocalAccounts(organizationId, showArchived);
    }
    init();
  }, [showArchived, loadLocalAccounts]);

  useEffect(() => {
    const unsubscribe = SyncEngine.subscribe((queueCount, isSyncing) => {
      if (!isSyncing && orgId) {
        loadLocalAccounts(orgId, showArchived);
      }
    });
    return () => unsubscribe();
  }, [orgId, showArchived, loadLocalAccounts]);

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

    let parsedVal = editingAccount ? editingAccount.starting_value : 0;
    if (!selectedLinkedOrgId) {
      const valValidation = SecurityService.validateAmount(startingVal, { min: -100_000_000, max: 1_000_000_000 });
      if (!valValidation.isValid) {
        Alert.alert('Error', valValidation.error || 'Please enter a valid numeric starting value.');
        return;
      }
      parsedVal = valValidation.value;
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

      if (editingAccount) {
        const updated: WalletAccount = {
          ...editingAccount,
          name: sanitizedName,
          starting_value: parsedVal,
          linked_org_id: selectedLinkedOrgId,
          linked_org_balance: selectedLinkedOrgId ? editingAccount.linked_org_balance ?? null : null,
          updated_at: new Date().toISOString(),
        };
        await OfflineDatabase.upsertAccount(updated, 'pending');
        await OfflineDatabase.enqueueMutation('UPDATE_ACCOUNT', updated);
      } else {
        const newAccount: WalletAccount = {
          id: generateUUID(),
          organization_id: orgId,
          name: sanitizedName,
          starting_value: parsedVal,
          is_active: true,
          linked_org_id: selectedLinkedOrgId,
          linked_org_balance: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await OfflineDatabase.upsertAccount(newAccount, 'pending');
        await OfflineDatabase.enqueueMutation('CREATE_ACCOUNT', newAccount);
      }

      setModalVisible(false);

      if (SyncEngine.getOnlineStatus()) {
        await SyncEngine.syncNow(orgId);
      }
      await loadLocalAccounts(orgId, showArchived);
      WidgetService.refreshWidgetData(orgId).catch(() => {});
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save account.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveAccount = (account: WalletAccount) => {
    Alert.alert(
      'Hide Sub-Account Balance',
      `Archive "${account.name}"? Its current balance will be hidden from your total net balance while all past transactions remain preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide Balance',
          style: 'destructive',
          onPress: async () => {
            if (!orgId) return;
            const updated = { ...account, is_active: false };
            await OfflineDatabase.upsertAccount(updated, 'pending');
            await OfflineDatabase.enqueueMutation('UPDATE_ACCOUNT', updated);

            if (SyncEngine.getOnlineStatus()) {
              SyncEngine.syncNow(orgId);
            }
            await loadLocalAccounts(orgId, showArchived);
            WidgetService.refreshWidgetData(orgId).catch(() => {});
          },
        },
      ]
    );
  };

  const handleDeleteAccount = (account: AccountWithBalance) => {
    if (account.transaction_count > 0) {
      Alert.alert(
        'Cannot Delete Account',
        `"${account.name}" is referenced by ${account.transaction_count} transaction${
          account.transaction_count === 1 ? '' : 's'
        }. To preserve historical balance integrity, you must archive this account instead of deleting it.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Archive Account',
            onPress: () => {
              setModalVisible(false);
              handleArchiveAccount(account);
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      'Delete Sub-Account',
      `Permanently delete "${account.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            if (!orgId) return;
            try {
              await OfflineDatabase.deleteAccount(account.id, orgId);
              await OfflineDatabase.enqueueMutation('DELETE_ACCOUNT', {
                id: account.id,
                organization_id: account.organization_id || orgId,
              });

              setModalVisible(false);
              setEditingAccount(null);
              await loadLocalAccounts(orgId, showArchived);
              WidgetService.refreshWidgetData(orgId).catch(() => {});

              if (SyncEngine.getOnlineStatus()) {
                SyncEngine.syncNow(orgId);
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete account.');
            }
          },
        },
      ]
    );
  };

  const handleUnarchiveAccount = (account: WalletAccount) => {
    Alert.alert(
      'Restore Sub-Account Balance',
      `Restore "${account.name}"? Its current balance will be included in your total net balance again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
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
            WidgetService.refreshWidgetData(orgId).catch(() => {});
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
          <Plus size={18} color={isDark ? colors.background : '#FFFFFF'} />
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
        {isLoading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : accounts.length === 0 ? (
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
                  <WalletIcon size={20} color={acc.is_active ? colors.primary : colors.textDim} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accName}>
                    {acc.name} {!acc.is_active && '(Archived • Balance Hidden)'}
                  </Text>
                  {acc.linked_org_id && (
                    <View style={styles.linkedBadge}>
                      <Link2 size={11} color={colors.primary} />
                      <Text style={styles.linkedBadgeText}>
                        {linkableOrgs.find((o) => o.id === acc.linked_org_id)?.name || 'Linked Org'} • Read-Only
                      </Text>
                    </View>
                  )}
                  <Text style={styles.accBalanceLarge}>
                    {formatCurrency(Number(acc.current_balance || 0), currency)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openEditModal(acc)}
                >
                  <Edit2 size={16} color={colors.textMuted} />
                </TouchableOpacity>
                {acc.is_active && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleArchiveAccount(acc)}
                  >
                    <Archive size={16} color={colors.textMuted} />
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
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Account Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Cash, Checking, Mobile Wallet"
              placeholderTextColor={colors.textDim}
              value={accName}
              onChangeText={setAccName}
            />

            {(linkableOrgs.length > 0 || selectedLinkedOrgId) && (
              <>
                <Text style={styles.inputLabel}>Link Organization Balance (Optional)</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.orgChipRow}
                >
                  <TouchableOpacity
                    style={[
                      styles.orgChip,
                      selectedLinkedOrgId === null && styles.orgChipActive,
                    ]}
                    onPress={() => setSelectedLinkedOrgId(null)}
                  >
                    <Text
                      style={[
                        styles.orgChipText,
                        selectedLinkedOrgId === null && styles.orgChipTextActive,
                      ]}
                    >
                      None (Manual)
                    </Text>
                  </TouchableOpacity>
                  {linkableOrgs.map((org) => (
                    <TouchableOpacity
                      key={org.id}
                      style={[
                        styles.orgChip,
                        selectedLinkedOrgId === org.id && styles.orgChipActive,
                      ]}
                      onPress={() => setSelectedLinkedOrgId(org.id)}
                    >
                      <Text
                        style={[
                          styles.orgChipText,
                          selectedLinkedOrgId === org.id && styles.orgChipTextActive,
                        ]}
                      >
                        {org.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={styles.inputLabel}>Starting Value</Text>
            <TextInput
              style={[
                styles.input,
                selectedLinkedOrgId ? styles.inputDisabled : null,
              ]}
              placeholder="0.00"
              placeholderTextColor={colors.textDim}
              keyboardType="decimal-pad"
              value={startingVal}
              onChangeText={setStartingVal}
              editable={!selectedLinkedOrgId}
            />
            {selectedLinkedOrgId && (
              <Text style={styles.linkedHintText}>
                Locked while linked — mirrors negated Business Held from the organization. Unlink anytime to restore manual tracking.
              </Text>
            )}

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
                  <Archive size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                  <Text style={styles.archiveModalButtonText}>
                    {editingAccount.is_active ? 'Hide Balance (Archive)' : 'Restore Balance (Unarchive)'}
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
                  <Trash2 size={18} color={colors.error} style={{ marginRight: 8 }} />
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

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
      color: colors.textWhite,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: Tokens.radius.full,
    },
    addButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: isDark ? colors.background : '#FFFFFF',
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
      color: colors.textMuted,
    },
    toggleBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Tokens.radius.full,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toggleBtnActive: {
      backgroundColor: colors.secondary,
      borderColor: colors.secondary,
    },
    toggleBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    toggleBtnTextActive: {
      color: isDark ? colors.background : '#FFFFFF',
    },
    listContainer: {
      flex: 1,
    },
    card: {
      ...Tokens.card,
      backgroundColor: colors.surfaceCard,
      borderColor: colors.border,
      shadowColor: isDark ? colors.primary : 'rgba(0, 0, 0, 0.06)',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Tokens.spacing.sm,
    },
    cardArchived: {
      opacity: 0.6,
      borderColor: colors.border,
    },
    cardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    linkedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: Tokens.radius.full,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    linkedBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.primary,
    },
    orgChipRow: {
      flexGrow: 0,
      marginBottom: 4,
    },
    orgChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Tokens.radius.full,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 8,
    },
    orgChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    orgChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    orgChipTextActive: {
      color: isDark ? colors.background : '#FFFFFF',
    },
    inputDisabled: {
      opacity: 0.55,
    },
    linkedHintText: {
      ...Tokens.typography.caption,
      color: colors.textMuted,
      marginTop: 6,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceElevated,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Tokens.spacing.md,
    },
    accName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    accBalanceLarge: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textWhite,
      marginTop: 2,
    },
    archiveBtn: {
      padding: 8,
    },
    emptyCard: {
      ...Tokens.card,
      backgroundColor: colors.surfaceCard,
      borderColor: colors.border,
      alignItems: 'center',
      padding: Tokens.spacing.xl,
    },
    emptyText: {
      ...Tokens.typography.body,
      color: colors.textMuted,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: Tokens.radius.xl,
      borderTopRightRadius: Tokens.radius.xl,
      padding: Tokens.spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderGlow,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Tokens.spacing.lg,
    },
    modalTitle: {
      ...Tokens.typography.h2,
      color: colors.textWhite,
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
      backgroundColor: colors.surfaceElevated,
      borderRadius: Tokens.radius.md,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Tokens.spacing.sm,
    },
    archiveModalButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textMuted,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.errorBg,
      borderRadius: Tokens.radius.md,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.errorBorder,
    },
    deleteButtonDisabled: {
      opacity: 0.6,
    },
    deleteButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.error,
    },
    safeguardHintText: {
      ...Tokens.typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 6,
    },
  });
