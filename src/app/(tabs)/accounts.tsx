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
import { Plus, Archive, X, Wallet as WalletIcon } from 'lucide-react-native';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { WalletAuthService } from '@/lib/auth/walletAuth';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';
import type { WalletAccount } from '@/types/wallet';

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [accName, setAccName] = useState('');
  const [startingVal, setStartingVal] = useState('0');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadLocalAccounts = useCallback(async (organizationId: string, archived: boolean) => {
    const list = await OfflineDatabase.getAccounts(organizationId, archived);
    setAccounts(list);
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
  }, [loadLocalAccounts, showArchived]);

  const handleCreateAccount = async () => {
    if (!orgId) return;
    if (!accName.trim()) {
      Alert.alert('Error', 'Please enter an account name.');
      return;
    }

    setSaving(true);
    try {
      const newAcc: WalletAccount = {
        id: `acc_local_${Date.now()}`,
        organization_id: orgId,
        name: accName.trim(),
        starting_value: parseFloat(startingVal) || 0,
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
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add account.');
    } finally {
      setSaving(false);
    }
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Wallet Sub-Accounts</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
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
            <View key={acc.id} style={[styles.card, !acc.is_active && styles.cardArchived]}>
              <View style={styles.cardLeft}>
                <View style={styles.iconBox}>
                  <WalletIcon size={20} color={acc.is_active ? Colors.primary : Colors.textDim} />
                </View>
                <View>
                  <Text style={styles.accName}>
                    {acc.name} {!acc.is_active && '(Archived)'}
                  </Text>
                  <Text style={styles.accValue}>
                    Starting Value: ${Number(acc.starting_value).toFixed(2)}
                  </Text>
                </View>
              </View>

              {acc.is_active && (
                <TouchableOpacity
                  style={styles.archiveBtn}
                  onPress={() => handleArchiveAccount(acc)}
                >
                  <Archive size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Account Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Sub-Account</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
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
              onPress={handleCreateAccount}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Creating...' : 'Create Account'}
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
    ...Tokens.typography.h3,
  },
  accValue: {
    ...Tokens.typography.caption,
    color: Colors.textMuted,
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
});
