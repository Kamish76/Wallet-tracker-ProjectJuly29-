import React, { useEffect, useState, useRef } from 'react';
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
import { router } from 'expo-router';
import { RefreshCw, LogOut, Check, Wifi, Database, ShieldAlert, Tag, ChevronDown } from 'lucide-react-native';
import { supabase } from '@/lib/supabase/client';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { WalletAuthService } from '@/lib/auth/walletAuth';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { WidgetService } from '@/lib/widget/widgetService';
import { registerBackgroundSync } from '@/lib/sync/backgroundTask';
import { ManageCategoriesModal } from '@/components/ManageCategoriesModal';
import Slider from '@react-native-community/slider';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';
import type { SyncSettings, SyncMode, ConflictResolutionRule, WalletCategory } from '@/types/wallet';

export default function SettingsScreen() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [settings, setSettings] = useState<SyncSettings>({
    mode: 'auto',
    intervalMinutes: 1440,
    conflictResolution: 'local_wins',
    autoSyncOnReconnect: true,
  });
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
      if (session?.user) {
        const { organizationId, currency: fetchedCurrency } = await WalletAuthService.resolveUserWallet(session.user.id);
        setOrgId(organizationId);
        setCurrency(fetchedCurrency);
        await loadCategories(organizationId);
      }
      const st = await SyncEngine.getSettings();
      setSettings(st);
      const count = await OfflineDatabase.getQueueCount();
      setPendingCount(count);

      const { opacity, balance } = await WidgetService.getWidgetState();
      setWidgetOpacity(opacity);
      setWidgetBalance(balance);
    }
    load();

    const unsubscribe = SyncEngine.subscribe((count, isSyncing) => {
      setPendingCount(count);
      setSyncing(isSyncing);
      if (!isSyncing && orgId) {
        loadCategories(orgId);
      }
    });
    return () => unsubscribe();
  }, [orgId]);

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
    await WidgetService.refreshWidgetData();
    const { opacity, balance } = await WidgetService.getWidgetState();
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
        currency: newCurrency
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
              <ChevronDown size={16} color={Colors.textLight} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.signOutButton, { alignSelf: 'auto' }]} onPress={handleSignOut}>
            <LogOut size={16} color={Colors.expense} />
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Offline & Sync Settings Section */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Wifi size={18} color={Colors.primary} />
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
            trackColor={{ false: Colors.border, true: Colors.primaryDark }}
            thumbColor={Colors.textWhite}
          />
        </View>

        {/* Manual Sync Trigger */}
        <View style={styles.queueStatusRow}>
          <Database size={16} color={Colors.textMuted} />
          <Text style={styles.queueStatusText}>
            Offline Queue: {pendingCount} pending item{pendingCount === 1 ? '' : 's'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.syncNowButton}
          onPress={handleSyncNow}
          disabled={syncing}
        >
          <RefreshCw size={18} color={Colors.background} />
          <Text style={styles.syncNowButtonText}>
            {syncing ? 'Synchronizing...' : 'Sync Now'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Home Screen Widget Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Home Screen Widget</Text>
        <Text style={styles.cardDescription}>
          Customize the background opacity of your Android home screen widget.
        </Text>

        {/* Live Preview Banner */}
        <View style={styles.previewContainer}>
          <Text style={styles.previewLabel}>LIVE PREVIEW</Text>
          <View
            style={[
              styles.widgetPreviewBanner,
              { backgroundColor: `rgba(32, 32, 32, ${widgetOpacity})` },
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
              <Text style={{ fontSize: 18, color: '#EF4444', fontWeight: 'bold' }}>↑</Text>
              <View style={styles.widgetPreviewDivider} />
              <Text style={{ fontSize: 18, color: '#10B981', fontWeight: 'bold' }}>↓</Text>
              <View style={styles.widgetPreviewDivider} />
              <Text style={{ fontSize: 18, color: '#3B82F6', fontWeight: 'bold' }}>⇄</Text>
            </View>
          </View>
        </View>

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
          minimumTrackTintColor={Colors.primary}
          maximumTrackTintColor={Colors.border}
          thumbTintColor={Colors.textWhite}
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

        <TouchableOpacity
          style={styles.syncNowButton}
          onPress={handleRefreshWidgetNow}
          disabled={updatingWidget}
        >
          <Text style={styles.syncNowButtonText}>
            {updatingWidget ? 'Updating Widget...' : 'Push Update to Home Screen'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Transaction Categories Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Tag size={18} color={Colors.primary} />
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
          <Tag size={18} color={Colors.background} />
          <Text style={styles.manageCategoriesText}>Manage Categories</Text>
        </TouchableOpacity>
      </View>

      {/* About Section */}
      <View style={styles.aboutCard}>
        <Text style={styles.aboutTitle}>OrgWallet v0.4.2</Text>
        <Text style={styles.aboutText}>
          Android-optimized mobile app for OrgFinance Personal Wallet tracking. Built with Expo React Native, Supabase, and SQLite offline synchronization.
        </Text>
        <TouchableOpacity 
          style={{ marginTop: 16 }}
          onPress={() => Linking.openURL('https://org-finance.vercel.app/')}
        >
          <Text style={[styles.aboutText, { color: Colors.primary, fontWeight: '600' }]}>
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
                minWidth: dropdownLayout.width 
              }
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
                  {currency === cur && <Check size={16} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  },
  card: {
    ...Tokens.card,
    marginBottom: Tokens.spacing.lg,
  },
  sectionLabel: {
    ...Tokens.typography.caption,
    color: Colors.primary,
    letterSpacing: 1.1,
    marginBottom: Tokens.spacing.xs,
  },
  profileEmail: {
    ...Tokens.typography.h2,
    marginBottom: 4,
  },
  profileSubtext: {
    ...Tokens.typography.caption,
    color: Colors.textMuted,
    marginBottom: Tokens.spacing.md,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Tokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    alignSelf: 'flex-start',
  },
  signOutButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.expense,
    marginLeft: 8,
  },
  currencySelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Tokens.radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Tokens.spacing.lg,
    alignSelf: 'flex-start',
  },
  currencySelectorLabel: {
    ...Tokens.typography.caption,
    color: Colors.textMuted,
    marginRight: 8,
  },
  currencySelectorValue: {
    ...Tokens.typography.body,
    fontWeight: '700',
    color: Colors.primary,
    marginRight: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    ...Tokens.typography.h2,
    marginLeft: 8,
  },
  cardDescription: {
    ...Tokens.typography.caption,
    color: Colors.textMuted,
    marginBottom: Tokens.spacing.lg,
  },
  fieldLabel: {
    ...Tokens.typography.caption,
    color: Colors.textLight,
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
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  pillTextActive: {
    color: Colors.background,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Tokens.spacing.md,
    marginBottom: Tokens.spacing.lg,
  },
  switchLabel: {
    ...Tokens.typography.body,
  },
  queueStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Tokens.spacing.md,
  },
  queueStatusText: {
    ...Tokens.typography.caption,
    color: Colors.textLight,
    marginLeft: 8,
  },
  syncNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Tokens.radius.md,
    paddingVertical: 14,
  },
  syncNowButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
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
    color: Colors.textMuted,
    marginBottom: 4,
  },
  aboutText: {
    ...Tokens.typography.caption,
    color: Colors.textDim,
    textAlign: 'center',
  },
  previewContainer: {
    marginVertical: Tokens.spacing.md,
    backgroundColor: '#0F1117',
    borderRadius: Tokens.radius.md,
    padding: Tokens.spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewLabel: {
    fontSize: 11,
    color: Colors.textMuted,
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
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  widgetPreviewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  widgetPreviewIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  widgetPreviewSubtext: {
    fontSize: 12,
    color: '#D1D5DB',
  },
  widgetPreviewBalance: {
    fontSize: 15,
    color: '#FFFFFF',
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
    backgroundColor: '#404040',
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
    backgroundColor: Colors.incomeBg,
    borderColor: Colors.income,
  },
  categoryBadgeExpense: {
    backgroundColor: Colors.expenseBg,
    borderColor: Colors.expense,
  },
  categoryBadgeMore: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Tokens.radius.full,
    borderWidth: 1,
  },
  categoryBadgeText: {
    ...Tokens.typography.caption,
    fontWeight: '600',
    color: Colors.textWhite,
  },
  categoryTextIncome: {
    color: Colors.income,
  },
  categoryTextExpense: {
    color: Colors.expense,
  },
  manageCategoriesButton: {
    backgroundColor: Colors.primary,
    borderRadius: Tokens.radius.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Tokens.spacing.sm,
  },
  manageCategoriesText: {
    ...Tokens.typography.body,
    color: Colors.background,
    fontWeight: '700',
  },
  currencyModalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Tokens.radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
    backgroundColor: Colors.primaryDark,
  },
  currencyItemText: {
    fontSize: 15,
    color: Colors.textWhite,
  },
  currencyItemTextActive: {
    fontWeight: '700',
    color: Colors.background,
  },
});

