import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Plus, Trash2, Edit2, Check, Tag } from 'lucide-react-native';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { generateUUID } from '@/lib/utils/uuid';
import { SecurityService } from '@/lib/security/securityService';
import { RateLimiter, RateLimitPolicies } from '@/lib/security/rateLimiter';
import type { WalletCategory } from '@/types/wallet';

interface ManageCategoriesModalProps {
  visible: boolean;
  onClose: () => void;
  orgId: string | null;
  onCategoriesChanged?: () => void;
}

export function ManageCategoriesModal({
  visible,
  onClose,
  orgId,
  onCategoriesChanged,
}: ManageCategoriesModalProps) {
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('expense');
  const [categories, setCategories] = useState<WalletCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // New category input state
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [isAdding, setIsAdding] = useState<boolean>(false);

  // Edit category state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const loadCategories = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const list = await OfflineDatabase.getCategories(orgId, activeTab);
      setCategories(list);
    } catch (e) {
      console.error('[ManageCategoriesModal] Error loading categories:', e);
    } finally {
      setLoading(false);
    }
  }, [orgId, activeTab]);

  useEffect(() => {
    if (visible && orgId) {
      loadCategories();
    } else {
      // reset states when hidden
      setNewCategoryName('');
      setEditingId(null);
      setEditingName('');
    }
  }, [visible, orgId, activeTab, loadCategories]);

  const handleAddCategory = async () => {
    if (!orgId) return;
    const sanitized = SecurityService.sanitizeText(newCategoryName, 60).trim();
    if (!sanitized) {
      Alert.alert('Invalid Name', 'Please enter a valid category name.');
      return;
    }

    // Check rate limit
    const rateStatus = await RateLimiter.checkLimit(
      'mutation:create',
      RateLimitPolicies.MUTATION_CREATE
    );
    if (!rateStatus.allowed) {
      Alert.alert(
        'Rate Limit Exceeded',
        `Too many mutations. Please try again in ${rateStatus.retryAfterSeconds}s.`
      );
      return;
    }
    await RateLimiter.recordAttempt(
      'mutation:create',
      RateLimitPolicies.MUTATION_CREATE
    );

    // Check duplicate in active tab
    const normalized = sanitized.toLowerCase();
    const exists = categories.some((c) => c.normalized_name === normalized);
    if (exists) {
      Alert.alert('Duplicate Category', 'A category with this name already exists.');
      return;
    }

    setIsAdding(true);
    try {
      const id = generateUUID();
      const now = new Date().toISOString();
      const newCat: WalletCategory = {
        id,
        organization_id: orgId,
        normalized_name: normalized,
        display_name: sanitized,
        aliases: [activeTab === 'income' ? 'type:income' : 'type:expense'],
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

      setNewCategoryName('');
      await loadCategories();
      onCategoriesChanged?.();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add category.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartEdit = (cat: WalletCategory) => {
    setEditingId(cat.id);
    setEditingName(cat.display_name);
  };

  const handleSaveEdit = async (cat: WalletCategory) => {
    if (!orgId) return;
    const sanitized = SecurityService.sanitizeText(editingName, 60).trim();
    if (!sanitized) {
      Alert.alert('Invalid Name', 'Category name cannot be empty.');
      return;
    }

    const normalized = sanitized.toLowerCase();
    const exists = categories.some(
      (c) => c.id !== cat.id && c.normalized_name === normalized
    );
    if (exists) {
      Alert.alert('Duplicate Category', 'Another category already uses this name.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const updated: WalletCategory = {
        ...cat,
        normalized_name: normalized,
        display_name: sanitized,
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
      };

      await OfflineDatabase.upsertCategory(updated, 'pending');
      await OfflineDatabase.enqueueMutation('UPDATE_CATEGORY', updated);

      if (SyncEngine.getOnlineStatus()) {
        SyncEngine.syncNow(orgId).catch(() => {});
      }

      setEditingId(null);
      setEditingName('');
      await loadCategories();
      onCategoriesChanged?.();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to rename category.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteCategory = (cat: WalletCategory) => {
    if (!orgId) return;
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${cat.display_name}"? Existing transactions will retain this category label.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await OfflineDatabase.deleteCategory(cat.id, orgId);
              await OfflineDatabase.enqueueMutation('DELETE_CATEGORY', {
                id: cat.id,
                organization_id: orgId,
              });

              if (SyncEngine.getOnlineStatus()) {
                SyncEngine.syncNow(orgId).catch(() => {});
              }

              await loadCategories();
              onCategoriesChanged?.();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete category.');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Tag size={20} color={Colors.primary} />
              <Text style={styles.title}>Transaction Categories</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close modal"
            >
              <X size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'expense' && styles.activeExpenseTab,
              ]}
              onPress={() => setActiveTab('expense')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'expense' && styles.activeTabText,
                ]}
              >
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'income' && styles.activeIncomeTab,
              ]}
              onPress={() => setActiveTab('income')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'income' && styles.activeTabText,
                ]}
              >
                Income
              </Text>
            </TouchableOpacity>
          </View>

          {/* Add Category Form */}
          <View style={styles.addFormContainer}>
            <TextInput
              style={styles.input}
              placeholder={`Add new ${activeTab} category...`}
              placeholderTextColor={Colors.textMuted}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={handleAddCategory}
            />
            <TouchableOpacity
              style={[
                styles.addButton,
                (!newCategoryName.trim() || isAdding) && styles.addButtonDisabled,
              ]}
              onPress={handleAddCategory}
              disabled={!newCategoryName.trim() || isAdding}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color={Colors.textWhite} />
              ) : (
                <Plus size={20} color={Colors.textWhite} />
              )}
            </TouchableOpacity>
          </View>

          {/* Categories List */}
          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <ScrollView
              style={styles.listScrollView}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            >
              {categories.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    No {activeTab} categories found. Add one above!
                  </Text>
                </View>
              ) : (
                categories.map((cat) => {
                  const isEditing = editingId === cat.id;
                  return (
                    <View key={cat.id} style={styles.categoryRow}>
                      {isEditing ? (
                        <View style={styles.editRow}>
                          <TextInput
                            style={styles.editInput}
                            value={editingName}
                            onChangeText={setEditingName}
                            maxLength={60}
                            autoFocus={true}
                            returnKeyType="done"
                            onSubmitEditing={() => handleSaveEdit(cat)}
                          />
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleSaveEdit(cat)}
                            disabled={isSavingEdit}
                          >
                            <Check size={18} color={Colors.success} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => setEditingId(null)}
                          >
                            <X size={18} color={Colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          <View style={styles.categoryLabelRow}>
                            <View
                              style={[
                                styles.colorDot,
                                {
                                  backgroundColor:
                                    activeTab === 'income'
                                      ? Colors.income
                                      : Colors.expense,
                                },
                              ]}
                            />
                            <Text style={styles.categoryName}>
                              {cat.display_name}
                            </Text>
                            {!cat.is_custom && (
                              <View style={styles.presetBadge}>
                                <Text style={styles.presetText}>Preset</Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.rowActions}>
                            <TouchableOpacity
                              style={styles.actionButton}
                              onPress={() => handleStartEdit(cat)}
                              accessibilityLabel={`Edit ${cat.display_name}`}
                            >
                              <Edit2 size={16} color={Colors.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.actionButton}
                              onPress={() => handleDeleteCategory(cat)}
                              accessibilityLabel={`Delete ${cat.display_name}`}
                            >
                              <Trash2 size={16} color={Colors.error} />
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.doneButton} onPress={onClose}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: Tokens.spacing.md,
  },
  modalCard: {
    ...Tokens.card,
    maxHeight: '80%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Tokens.spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Tokens.spacing.sm,
  },
  title: {
    ...Tokens.typography.h3,
  },
  closeButton: {
    padding: Tokens.spacing.xs,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Tokens.radius.md,
    padding: 3,
    marginBottom: Tokens.spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Tokens.spacing.sm,
    alignItems: 'center',
    borderRadius: Tokens.radius.sm,
  },
  activeExpenseTab: {
    backgroundColor: Colors.expenseBg,
    borderColor: Colors.expense,
    borderWidth: 1,
  },
  activeIncomeTab: {
    backgroundColor: Colors.incomeBg,
    borderColor: Colors.income,
    borderWidth: 1,
  },
  tabText: {
    ...Tokens.typography.caption,
    fontSize: 14,
    color: Colors.textMuted,
  },
  activeTabText: {
    color: Colors.textWhite,
    fontWeight: '700',
  },
  addFormContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Tokens.spacing.sm,
    marginBottom: Tokens.spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Tokens.radius.md,
    paddingHorizontal: Tokens.spacing.md,
    paddingVertical: Tokens.spacing.sm,
    color: Colors.textWhite,
    fontSize: 15,
  },
  addButton: {
    backgroundColor: Colors.primaryDark,
    width: 44,
    height: 44,
    borderRadius: Tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  loaderContainer: {
    paddingVertical: Tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listScrollView: {
    flexGrow: 0,
    maxHeight: 320,
  },
  listContent: {
    paddingBottom: Tokens.spacing.md,
    gap: Tokens.spacing.sm,
  },
  emptyContainer: {
    paddingVertical: Tokens.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...Tokens.typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Tokens.radius.md,
    paddingHorizontal: Tokens.spacing.md,
    paddingVertical: Tokens.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Tokens.spacing.sm,
    flex: 1,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryName: {
    ...Tokens.typography.body,
    color: Colors.textWhite,
    flex: 1,
  },
  presetBadge: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: Tokens.spacing.sm,
    paddingVertical: 2,
    borderRadius: Tokens.radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetText: {
    ...Tokens.typography.caption,
    fontSize: 10,
    color: Colors.textMuted,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Tokens.spacing.xs,
  },
  actionButton: {
    padding: Tokens.spacing.sm,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Tokens.spacing.xs,
  },
  editInput: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Tokens.radius.sm,
    paddingHorizontal: Tokens.spacing.sm,
    paddingVertical: 6,
    color: Colors.textWhite,
    fontSize: 14,
  },
  footer: {
    marginTop: Tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Tokens.spacing.md,
  },
  doneButton: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Tokens.radius.md,
    paddingVertical: Tokens.spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  doneText: {
    ...Tokens.typography.body,
    color: Colors.textWhite,
    fontWeight: '600',
  },
});
