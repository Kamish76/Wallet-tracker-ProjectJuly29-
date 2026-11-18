import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StyleSheet,
  Image,
  Linking,
  Modal,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { RefreshCw, LogOut, Check, Wifi, Database, Tag, ChevronDown, Palette, Sun, Moon, Smartphone, Trash2, AlertTriangle, Clock } from 'lucide-react-native';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { WalletAuthService } from '@/lib/auth/walletAuth';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { WidgetService } from '@/lib/widget/widgetService';
import { registerBackgroundSync } from '@/lib/sync/backgroundTask';
import { ManageCategoriesModal } from '@/components/ManageCategoriesModal';
import Slider from '@react-native-community/slider';
import { useTheme, type ThemeMode } from '@/theme/ThemeContext';
import { Tokens } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/colors';
import type { SyncSettings, SyncMode, ConflictResolutionRule, WalletCategory } from '@/types/wallet';

export default function SettingsScreen() {
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [settings, setSettings] = useState<SyncSettings>({
    mode: 'auto',
    intervalMinutes: 1440,
    conflictResolution: 'local_wins',
    autoSyncOnReconnect: true,
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<{
    id: string;
    scheduled_deletion_at: string;
    requested_at: string;
  } | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [cancellingDeletion, setCancellingDeletion] = useState(false);

  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [widgetOpacity, setWidgetOpacity] = useState(0.85);
  const [widgetBalance, setWidgetBalance] = useState('$0.00');
  const [updatingWidget, setUpdatingWidget] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [categories, setCategories] = useState<WalletCategory[]>([]);
  const [categoriesModalVisible, setCategoriesModalVisible] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [updatingCurrency, setUpdatingCurrency] = useState(false);
  const [dropdownLayout, setDropdownLayout] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<View>(null);

  const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'PHP'];

  const loadDeletionStatus = async (uid: string) => {
    try {
      const req = await WalletAuthService.getPendingAccountDeletion(uid);
      setPendingDeletion(req);
    } catch (e) {
      console.warn('[Settings] Error checking deletion status:', e);
    }
  };

  const loadCategories = async (organizationId: string) => {
    try {
      const cats = await OfflineDatabase.getCategories(organizationId);
      setCategories(cats);
    } catch (e) {
      console.error('[Settings] Error loading categories:', e);
    }
  };

  useEffect(() => {
    async function load() {
      const session = await WalletAuthService.getSession();
      setUserEmail(session?.user?.email || 'Logged In');
      let resolvedOrgId: string | undefined = undefined;
      if (session?.user) {
        setUserId(session.user.id);
        await loadDeletionStatus(session.user.id);
        const { organizationId, currency: fetchedCurrency } = await WalletAuthService.resolveUserWallet(session.user.id);
        resolvedOrgId = organizationId;
        setOrgId(organizationId);
        setCurrency(fetchedCurrency);
        await loadCategories(organizationId);
      }
      const st = await SyncEngine.getSettings();
      setSettings(st);
      const count = await OfflineDatabase.getQueueCount();
      setPendingCount(count);

      const { opacity, balance } = await WidgetService.getWidgetState(resolvedOrgId);
      setWidgetOpacity(opacity);
      setWidgetBalance(balance);
    }
    load();

    const unsubscribe = SyncEngine.subscribe((count, isSyncing) => {
      setPendingCount(count);
      setSyncing(isSyncing);
      if (!isSyncing && orgId) {
        loadCategories(orgId);
        WidgetService.getWidgetState(orgId).then(({ opacity, balance }) => {
          setWidgetOpacity(opacity);
          setWidgetBalance(balance);
        }).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, [orgId]);

  useFocusEffect(
    React.useCallback(() => {
      if (userId) {
        loadDeletionStatus(userId);
      }
      if (orgId) {
        WalletAuthService.getCachedCurrencyAsync().then(setCurrency).catch(() => {});
        WidgetService.getWidgetState(orgId).then(({ opacity, balance }) => {
          setWidgetOpacity(opacity);
          setWidgetBalance(balance);
        }).catch(() => {});
      }
    }, [orgId, userId])
  );

  const handleUpdateMode = async (mode: SyncMode) => {
    const updated = await SyncEngine.updateSettings({ mode });
    setSettings(updated);
  };

  const handleUpdateInterval = async (intervalMinutes: number) => {
    const updated = await SyncEngine.updateSettings({ intervalMinutes });
    setSettings(updated);
    // Re-register to apply new interval to the OS task manager
    registerBackgroundSync();
  };

  const handleUpdateConflict = async (conflictResolution: ConflictResolutionRule) => {
    const updated = await SyncEngine.updateSettings({ conflictResolution });
    setSettings(updated);
  };

  const handleToggleAutoReconnect = async (val: boolean) => {
    const updated = await SyncEngine.updateSettings({ autoSyncOnReconnect: val });
    setSettings(updated);
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    const result = await SyncEngine.syncNow();
    setSyncing(false);
    if (result.success) {
      Alert.alert('Sync Successful', 'All offline transactions and accounts are synchronized with Supabase.');
    } else {
      Alert.alert('Sync Notice', result.error || 'Check internet connection or queue items.');
    }
  };

  const remainingDays = useMemo(() => {
    if (!pendingDeletion?.scheduled_deletion_at) return 30;
    const diffMs = new Date(pendingDeletion.scheduled_deletion_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }, [pendingDeletion]);

  const handleConfirmDelete = async () => {
    if (!userId) return;
    setDeletingAccount(true);
    try {
      const req = await WalletAuthService.requestAccountDeletion(userId, userEmail || '');
      setPendingDeletion(req);
      setDeleteModalVisible(false);
      Alert.alert(
        'Deletion Scheduled',
        'Your account has been scheduled for permanent deletion in 30 days. You can cancel this request at any time from this Settings screen.'
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to schedule account deletion. Please check your internet connection.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleCancelDeletion = async () => {
    if (!pendingDeletion) return;
    Alert.alert(
      'Cancel Deletion Request',
      'Are you sure you want to cancel the scheduled deletion? Your account and personal wallet will remain active.',
      [
        { text: 'Keep Scheduled', style: 'cancel' },
        {
          text: 'Cancel Deletion',
          style: 'default',
          onPress: async () => {
            setCancellingDeletion(true);
            try {
              await WalletAuthService.cancelAccountDeletion(pendingDeletion.id);
              setPendingDeletion(null);
              Alert.alert('Request Cancelled', 'Your account deletion request has been cancelled. Your account remains active.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to cancel deletion request. Please check your internet connection.');
            } finally {
              setCancellingDeletion(false);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of OrgWallet?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await WalletAuthService.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleUpdateWidgetOpacity = async (val: number) => {
    setWidgetOpacity(val);
    await WidgetService.setOpacity(val);
  };

  const handleRefreshWidgetNow = async () => {
    setUpdatingWidget(true);
    await WidgetService.refreshWidgetData(orgId || undefined, undefined, currency);
    const { opacity, balance } = await WidgetService.getWidgetState(orgId || undefined, undefined, currency);
    setWidgetOpacity(opacity);
    setWidgetBalance(balance);
    setUpdatingWidget(false);
  };

  const handleUpdateCurrency = async (newCurrency: string) => {
    if (!orgId) return;
    setUpdatingCurrency(true);
    try {
      await OfflineDatabase.enqueueMutation('UPDATE_ORGANIZATION', {
        id: orgId,
        currency: newCurrency,
      });

      await WalletAuthService.updateCachedCurrency(newCurrency);
      setCurrency(newCurrency);
      setCurrencyModalVisible(false);

      WidgetService.refreshWidgetData(orgId).catch(() => {});
      SyncEngine.syncNow().catch(() => {});

      // Force an app reload so other tabs fetch the new currency immediately
      router.replace('/');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update currency.');
    } finally {
      setUpdatingCurrency(false);
    }
  };

  const openCurrencyModal = () => {
    if (Platform.OS === 'web') {
      const node = buttonRef.current as any;
      if (node && typeof node.getBoundingClientRect === 'function') {
        const rect = node.getBoundingClientRect();
        setDropdownLayout({
          top: rect.top + rect.height + 8,
          left: rect.left,
          width: Math.max(rect.width, 160),
        });
        setCurrencyModalVisible(true);
      }
    } else {
      buttonRef.current?.measure((x, y, width, height, pageX, pageY) => {
        setDropdownLayout({
          top: pageY + height + 8,
          left: pageX,
          width: Math.max(width, 160),
        });
        setCurrencyModalVisible(true);
      });
    }
  };

  const previewBaseColor = isDark ? '32, 32, 32' : '255, 255, 255';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require('../../../assets/icon.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Wallet Settings</Text>
      </View>

      {/* Pending Account Deletion Warning Card */}
      {pendingDeletion && (
        <View style={styles.deletionWarningCard}>
          <View style={styles.deletionWarningHeader}>
            <AlertTriangle size={20} color={colors.expense} />
            <Text style={styles.deletionWarningTitle}>Account Scheduled for Deletion</Text>
          </View>
          <Text style={styles.deletionWarningText}>
            Your account and personal wallet data are scheduled for permanent deletion in{' '}
            <Text style={{ fontWeight: '700', color: colors.expense }}>
              {remainingDays} day{remainingDays === 1 ? '' : 's'}
            </Text>
            . During this 30-day grace period, all services remain active. You can cancel this request at any time before the scheduled date.
          </Text>
          <TouchableOpacity
            style={styles.cancelDeletionButton}
            onPress={handleCancelDeletion}
            disabled={cancellingDeletion}
          >
            <Clock size={16} color={colors.primary} />
            <Text style={styles.cancelDeletionButtonText}>
              {cancellingDeletion ? 'Cancelling...' : 'Cancel Deletion Request'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Account Profile Card */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>ORGANIZATION ACCOUNT</Text>
        <Text style={styles.profileEmail}>{userEmail}</Text>
        <Text style={[styles.profileSubtext, { marginBottom: Tokens.spacing.md }]}>
          Unified access with OrgFinance web app (Personal Wallet Mode)
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View ref={buttonRef} collapsable={false}>
            <TouchableOpacity
              style={[styles.currencySelectorButton, { marginBottom: 0 }]}
              onPress={openCurrencyModal}
            >
              <Text style={styles.currencySelectorLabel}>Currency:</Text>
              <Text style={styles.currencySelectorValue}>{currency}</Text>
              <ChevronDown size={16} color={colors.textLight} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {!pendingDeletion && (
              <TouchableOpacity
                style={styles.deleteAccountButton}
                onPress={() => setDeleteModalVisible(true)}
              >
                <Trash2 size={16} color={colors.expense} />
                <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <LogOut size={16} color={colors.expense} />
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Appearance & Theme Section */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Palette size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Appearance & Theme</Text>
        </View>
        <Text style={styles.cardDescription}>
          Control the theme of OrgWallet across all screens and home screen widgets.
        </Text>

        <Text style={styles.fieldLabel}>Theme Mode</Text>
        <View style={styles.pillsRow}>
          {(
            [
              { key: 'auto', label: 'System (Auto)', icon: Smartphone },
              { key: 'light', label: 'Light', icon: Sun },
              { key: 'dark', label: 'Dark', icon: Moon },
            ] as const
          ).map((item) => {
            const IconComponent = item.icon;
            const isActive = themeMode === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.pill,
                  isActive && styles.pillActive,
                  { flexDirection: 'row', alignItems: 'center', gap: 6 },
                ]}
                onPress={() => setThemeMode(item.key)}
              >
                <IconComponent
                  size={14}
                  color={isActive ? (isDark ? colors.background : '#FFFFFF') : colors.textMuted}
                />
                <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.profileSubtext, { marginBottom: 0 }]}>
          Active: {isDark ? 'Dark Mode' : 'Light Mode'} {themeMode === 'auto' ? '(following OS appearance)' : '(manually pinned)'} • Automatically synchronizes with your Android & iOS home screen widgets.
        </Text>
      </View>

      {/* Offline & Sync Settings Section */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Wifi size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Offline & Sync Settings</Text>
        </View>
        <Text style={styles.cardDescription}>
          Control how offline transactions are queued and synchronized to Supabase when connection is restored.
        </Text>

        {/* Sync Mode */}
        <Text style={styles.fieldLabel}>Sync Mode</Text>
        <View style={styles.pillsRow}>
          {(
            [
              { key: 'auto', label: 'Automatic' },
              { key: 'wifi_only', label: 'Wi-Fi Only' },
              { key: 'manual', label: 'Manual Only' },
            ] as const
          ).map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.pill,
                settings.mode === item.key && styles.pillActive,
              ]}
              onPress={() => handleUpdateMode(item.key)}
            >
              <Text
                style={[
                  styles.pillText,
                  settings.mode === item.key && styles.pillTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Background Sync Interval */}
        <Text style={styles.fieldLabel}>Periodic Sync Interval</Text>
        <View style={styles.pillsRow}>
          {(
            [
              { key: 60, label: '1 hour' },
              { key: 180, label: '3 hours' },
              { key: 360, label: '6 hours' },
              { key: 720, label: '12 hours' },
              { key: 1440, label: '24 hours' },
            ] as const
          ).map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.pill,
                settings.intervalMinutes === item.key && styles.pillActive,
              ]}
              onPress={() => handleUpdateInterval(item.key)}
            >
              <Text
                style={[
                  styles.pillText,
                  settings.intervalMinutes === item.key && styles.pillTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Conflict Resolution Rule */}
        <Text style={styles.fieldLabel}>Conflict Resolution Priority</Text>
        <View style={styles.pillsRow}>
          {(
            [
              { key: 'local_wins', label: 'Local Wins (Overwrite)' },
              { key: 'server_wins', label: 'Server Wins (Discard)' },
            ] as const
          ).map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.pill,
                settings.conflictResolution === item.key && styles.pillActive,
              ]}
              onPress={() => handleUpdateConflict(item.key)}
            >
              <Text
                style={[
                  styles.pillText,
                  settings.conflictResolution === item.key && styles.pillTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Auto Sync on Reconnect Toggle */}
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Sync immediately when online</Text>
          <Switch
            value={settings.autoSyncOnReconnect}
            onValueChange={handleToggleAutoReconnect}
            trackColor={{ false: colors.border, true: colors.primaryDark }}
            thumbColor={isDark ? colors.textWhite : colors.primary}
          />
        </View>

        {/* Manual Sync Trigger */}
        <View style={styles.queueStatusRow}>
          <Database size={16} color={colors.textMuted} />
          <Text style={styles.queueStatusText}>
            Offline Queue: {pendingCount} pending item{pendingCount === 1 ? '' : 's'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.syncNowButton}
          onPress={handleSyncNow}
          disabled={syncing}
        >
          <RefreshCw size={18} color={isDark ? colors.background : '#FFFFFF'} />
          <Text style={styles.syncNowButtonText}>
            {syncing ? 'Synchronizing...' : 'Sync Now'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Home Screen Widget Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Home Screen Widget</Text>
        <Text style={styles.cardDescription}>
          {Platform.OS === 'android'
            ? 'Customize the background opacity of your Android home screen widget. The widget dynamically follows your selected theme.'
            : Platform.OS === 'ios'
            ? 'Preview your iOS WidgetKit (Small 2x2 & Medium 4x2) home screen widgets. The widget dynamically follows your selected theme or iOS system appearance.'
            : 'Customize widget opacity preview. Home screen widgets are supported on Android and iOS.'}
        </Text>

        {/* Live Preview Banner */}
        <View style={styles.previewContainer}>
          <Text style={styles.previewLabel}>LIVE PREVIEW ({isDark ? 'DARK THEME' : 'LIGHT THEME'})</Text>
          <View
            style={[
              styles.widgetPreviewBanner,
              {
                backgroundColor: `rgba(${previewBaseColor}, ${
                  Platform.OS === 'ios' ? 1 : widgetOpacity
                })`,
              },
            ]}
          >
            <View style={styles.widgetPreviewLeft}>
              <View style={styles.widgetPreviewIcon}>
                <Text style={{ fontSize: 16 }}>💳</Text>
              </View>
              <View>
                <Text style={styles.widgetPreviewSubtext}>All accounts</Text>
                <Text style={styles.widgetPreviewBalance}>{widgetBalance}</Text>
              </View>
            </View>
            <View style={styles.widgetPreviewRight}>
              <Text style={{ fontSize: 18, color: colors.expense, fontWeight: 'bold' }}>↑</Text>
              <View style={styles.widgetPreviewDivider} />
              <Text style={{ fontSize: 18, color: colors.income, fontWeight: 'bold' }}>↓</Text>
              <View style={styles.widgetPreviewDivider} />
              <Text style={{ fontSize: 18, color: colors.syncing, fontWeight: 'bold' }}>⇄</Text>
            </View>
          </View>
        </View>

        {Platform.OS !== 'ios' && (
          <>
            <Text style={styles.fieldLabel}>
              Background Opacity: {Math.round(widgetOpacity * 100)}%
            </Text>
            <Slider
              style={{ width: '100%', height: 40, marginTop: 4 }}
              minimumValue={0.1}
              maximumValue={1.0}
              step={0.05}
              value={widgetOpacity}
              onValueChange={(val) => setWidgetOpacity(val)}
              onSlidingComplete={handleUpdateWidgetOpacity}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={isDark ? colors.textWhite : colors.primary}
            />

            {/* Preset Pills */}
            <View style={styles.pillsRow}>
              {[0.25, 0.5, 0.75, 0.85, 1.0].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.pill,
                    Math.abs(widgetOpacity - preset) < 0.03 && styles.pillActive,
                  ]}
                  onPress={() => handleUpdateWidgetOpacity(preset)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      Math.abs(widgetOpacity - preset) < 0.03 && styles.pillTextActive,
                    ]}
                  >
                    {Math.round(preset * 100)}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity
          style={styles.syncNowButton}
          onPress={handleRefreshWidgetNow}
          disabled={updatingWidget || (Platform.OS !== 'android' && Platform.OS !== 'ios')}
        >
          <Text style={styles.syncNowButtonText}>
            {Platform.OS !== 'android' && Platform.OS !== 'ios'
              ? 'Widget Update (Mobile Only)'
              : updatingWidget
              ? 'Updating Widget...'
              : 'Push Update to Home Screen'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Transaction Categories Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Tag size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Transaction Categories</Text>
        </View>
        <Text style={styles.cardDescription}>
          Manage preset and custom income/expense categories for your personal wallet.
        </Text>

        {/* Category Pill preview badges */}
        <View style={styles.categoriesPreviewRow}>
          {categories.slice(0, 8).map((cat) => {
            const isIncome = cat.aliases?.includes('type:income');
            return (
              <View
                key={cat.id}
                style={[
                  styles.categoryBadge,
                  isIncome ? styles.categoryBadgeIncome : styles.categoryBadgeExpense,
                ]}
              >
                <Text
                  style={[
                    styles.categoryBadgeText,
                    isIncome ? styles.categoryTextIncome : styles.categoryTextExpense,
                  ]}
                >
                  {cat.display_name}
                </Text>
              </View>
            );
          })}
          {categories.length > 8 && (
            <View style={styles.categoryBadgeMore}>
              <Text style={styles.categoryBadgeText}>+{categories.length - 8} more</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.manageCategoriesButton}
          onPress={() => setCategoriesModalVisible(true)}
        >
          <Tag size={18} color={isDark ? colors.background : '#FFFFFF'} />
          <Text style={styles.manageCategoriesText}>Manage Categories</Text>
        </TouchableOpacity>
      </View>

      {/* About Section */}
      <View style={styles.aboutCard}>
        <Text style={styles.aboutTitle}>OrgWallet v0.4.4</Text>
        <Text style={styles.aboutText}>
          Cross-platform mobile app for OrgFinance Personal Wallet tracking. Built with Expo React Native, Supabase, and SQLite offline synchronization.
        </Text>
        <TouchableOpacity
          style={{ marginTop: 16 }}
          onPress={() => Linking.openURL('https://org-finance.vercel.app/')}
        >
          <Text style={[styles.aboutText, { color: colors.primary, fontWeight: '600' }]}>
            🌐 Explore the full Web Experience
          </Text>
          <Text style={[styles.aboutText, { fontSize: 13, opacity: 0.7, marginTop: 4 }]}>
            org-finance.vercel.app
          </Text>
        </TouchableOpacity>
      </View>

      <ManageCategoriesModal
        visible={categoriesModalVisible}
        onClose={() => setCategoriesModalVisible(false)}
        orgId={orgId}
        onCategoriesChanged={() => orgId && loadCategories(orgId)}
      />

      {/* Delete Account Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteModalIconContainer}>
              <AlertTriangle size={28} color={colors.expense} />
            </View>
            <Text style={styles.deleteModalTitle}>Delete Account & Data?</Text>
            <Text style={styles.deleteModalDescription}>
              In accordance with Apple App Store and Google Play privacy guidelines, you can request permanent deletion of your account.
              {'\n\n'}
              • A <Text style={{ fontWeight: '700', color: colors.textWhite }}>30-day grace period</Text> will begin immediately.
              {'\n'}
              • You can log in and cancel this request at any time during the 30 days.
              {'\n'}
              • After 30 days, your personal wallet organizations, accounts, transactions, and categories will be permanently purged from all servers.
            </Text>

            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setDeleteModalVisible(false)}
                disabled={deletingAccount}
              >
                <Text style={styles.modalCancelButtonText}>Keep Account</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmDeleteButton}
                onPress={handleConfirmDelete}
                disabled={deletingAccount}
              >
                <Text style={styles.modalConfirmDeleteButtonText}>
                  {deletingAccount ? 'Scheduling...' : 'Schedule Deletion'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Currency Selector Dropdown Modal */}
      <Modal visible={currencyModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setCurrencyModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.currencyModalCard,
              {
                position: 'absolute',
                top: dropdownLayout.top,
                left: dropdownLayout.left,
                minWidth: dropdownLayout.width,
              },
            ]}
          >
            <View style={styles.currencyList}>
              {SUPPORTED_CURRENCIES.map((cur) => (
                <TouchableOpacity
                  key={cur}
                  style={[
                    styles.currencyItem,
                    currency === cur && styles.currencyItemActive,
                  ]}
                  disabled={updatingCurrency}
                  onPress={() => handleUpdateCurrency(cur)}
                >
                  <Text
                    style={[
                      styles.currencyItemText,
                      currency === cur && styles.currencyItemTextActive,
                    ]}
                  >
                    {cur}
                  </Text>
                  {currency === cur && <Check size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: Tokens.spacing.md,
      paddingBottom: Tokens.spacing.xxl,
    },
    header: {
      marginBottom: Tokens.spacing.lg,
      paddingTop: Tokens.spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerLogo: {
      width: 32,
      height: 32,
      borderRadius: 8,
      marginRight: 12,
    },
    title: {
      ...Tokens.typography.h1,
      color: colors.textWhite,
    },
    card: {
      ...Tokens.card,
      backgroundColor: colors.surfaceCard,
      borderColor: colors.border,
      shadowColor: isDark ? colors.primary : 'rgba(0, 0, 0, 0.08)',
      marginBottom: Tokens.spacing.lg,
    },
    sectionLabel: {
      ...Tokens.typography.caption,
      color: colors.primary,
      letterSpacing: 1.1,
      marginBottom: Tokens.spacing.xs,
    },
    profileEmail: {
      ...Tokens.typography.h2,
      color: colors.textWhite,
      marginBottom: 4,
    },
    profileSubtext: {
      ...Tokens.typography.caption,
      color: colors.textMuted,
      marginBottom: Tokens.spacing.md,
    },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: Tokens.radius.md,
      borderWidth: 1,
      borderColor: colors.errorBorder,
      alignSelf: 'flex-start',
    },
    signOutButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.expense,
      marginLeft: 8,
    },
    currencySelectorButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: Tokens.radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Tokens.spacing.lg,
      alignSelf: 'flex-start',
    },
    currencySelectorLabel: {
      ...Tokens.typography.caption,
      color: colors.textMuted,
      marginRight: 8,
    },
    currencySelectorValue: {
      ...Tokens.typography.body,
      fontWeight: '700',
      color: colors.primary,
      marginRight: 8,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    cardTitle: {
      ...Tokens.typography.h2,
      color: colors.textWhite,
      marginLeft: 8,
    },
    cardDescription: {
      ...Tokens.typography.caption,
      color: colors.textMuted,
      marginBottom: Tokens.spacing.lg,
    },
    fieldLabel: {
      ...Tokens.typography.caption,
      color: colors.textLight,
      marginBottom: 8,
    },
    pillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: Tokens.spacing.lg,
    },
    pill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: Tokens.radius.full,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 8,
      marginBottom: 8,
    },
    pillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pillText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    pillTextActive: {
      color: isDark ? colors.background : '#FFFFFF',
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: Tokens.spacing.md,
      marginBottom: Tokens.spacing.lg,
    },
    switchLabel: {
      ...Tokens.typography.body,
      color: colors.textWhite,
    },
    queueStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Tokens.spacing.md,
    },
    queueStatusText: {
      ...Tokens.typography.caption,
      color: colors.textLight,
      marginLeft: 8,
    },
    syncNowButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: Tokens.radius.md,
      paddingVertical: 14,
    },
    syncNowButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? colors.background : '#FFFFFF',
      marginLeft: 8,
    },
    aboutCard: {
      ...Tokens.card,
      backgroundColor: 'transparent',
      borderWidth: 0,
      alignItems: 'center',
      padding: Tokens.spacing.md,
    },
    aboutTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 4,
    },
    aboutText: {
      ...Tokens.typography.caption,
      color: colors.textDim,
      textAlign: 'center',
    },
    previewContainer: {
      marginVertical: Tokens.spacing.md,
      backgroundColor: colors.surfaceCard,
      borderRadius: Tokens.radius.md,
      padding: Tokens.spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewLabel: {
      fontSize: 11,
      color: colors.textMuted,
      letterSpacing: 0.8,
      marginBottom: Tokens.spacing.sm,
    },
    widgetPreviewBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 28,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    widgetPreviewLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    widgetPreviewIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? colors.surfaceElevated : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    widgetPreviewSubtext: {
      fontSize: 12,
      color: colors.textMuted,
    },
    widgetPreviewBalance: {
      fontSize: 15,
      color: colors.textWhite,
      fontWeight: 'bold',
    },
    widgetPreviewRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    widgetPreviewDivider: {
      width: 1,
      height: 18,
      backgroundColor: colors.border,
    },
    categoriesPreviewRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Tokens.spacing.xs,
      marginVertical: Tokens.spacing.md,
    },
    categoryBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Tokens.radius.full,
      borderWidth: 1,
    },
    categoryBadgeIncome: {
      backgroundColor: colors.incomeBg,
      borderColor: colors.income,
    },
    categoryBadgeExpense: {
      backgroundColor: colors.expenseBg,
      borderColor: colors.expense,
    },
    categoryBadgeMore: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Tokens.radius.full,
      borderWidth: 1,
    },
    categoryBadgeText: {
      ...Tokens.typography.caption,
      fontWeight: '600',
      color: colors.textWhite,
    },
    categoryTextIncome: {
      color: colors.income,
    },
    categoryTextExpense: {
      color: colors.expense,
    },
    manageCategoriesButton: {
      backgroundColor: colors.primary,
      borderRadius: Tokens.radius.md,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Tokens.spacing.sm,
    },
    manageCategoriesText: {
      ...Tokens.typography.body,
      color: isDark ? colors.background : '#FFFFFF',
      fontWeight: '700',
    },
    currencyModalCard: {
      backgroundColor: colors.surface,
      borderRadius: Tokens.radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
      padding: Tokens.spacing.xs,
    },
    currencyList: {
      paddingVertical: Tokens.spacing.xs,
    },
    currencyItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: Tokens.spacing.md,
      borderRadius: Tokens.radius.sm,
    },
    currencyItemActive: {
      backgroundColor: colors.primaryDark,
    },
    currencyItemText: {
      fontSize: 15,
      color: colors.textWhite,
    },
    currencyItemTextActive: {
      fontWeight: '700',
      color: isDark ? colors.background : '#FFFFFF',
    },
    deletionWarningCard: {
      ...Tokens.card,
      backgroundColor: colors.errorBg,
      borderColor: colors.errorBorder,
      borderWidth: 1,
      marginBottom: Tokens.spacing.lg,
      padding: Tokens.spacing.md,
    },
    deletionWarningHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    deletionWarningTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.expense,
    },
    deletionWarningText: {
      ...Tokens.typography.caption,
      color: colors.textLight,
      lineHeight: 18,
      marginBottom: 12,
    },
    cancelDeletionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: Tokens.radius.md,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 16,
      gap: 6,
    },
    cancelDeletionButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    deleteAccountButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: Tokens.radius.md,
      borderWidth: 1,
      borderColor: colors.errorBorder,
      gap: 6,
    },
    deleteAccountButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.expense,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Tokens.spacing.lg,
    },
    deleteModalCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.surface,
      borderRadius: Tokens.radius.lg,
      padding: Tokens.spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    deleteModalIconContainer: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.errorBg,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: Tokens.spacing.md,
    },
    deleteModalTitle: {
      ...Tokens.typography.h2,
      color: colors.textWhite,
      textAlign: 'center',
      marginBottom: Tokens.spacing.sm,
    },
    deleteModalDescription: {
      ...Tokens.typography.body,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textLight,
      marginBottom: Tokens.spacing.lg,
    },
    deleteModalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 12,
    },
    modalCancelButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: Tokens.radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    modalCancelButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textLight,
    },
    modalConfirmDeleteButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: Tokens.radius.md,
      backgroundColor: colors.expense,
    },
    modalConfirmDeleteButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
