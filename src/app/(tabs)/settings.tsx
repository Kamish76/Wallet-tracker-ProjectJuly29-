import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { RefreshCw, LogOut, Check, Wifi, Database, ShieldAlert } from 'lucide-react-native';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { WalletAuthService } from '@/lib/auth/walletAuth';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';
import type { SyncSettings, SyncMode, ConflictResolutionRule } from '@/types/wallet';

export default function SettingsScreen() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [settings, setSettings] = useState<SyncSettings>({
    mode: 'auto',
    intervalMinutes: 15,
    conflictResolution: 'local_wins',
    autoSyncOnReconnect: true,
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    async function load() {
      const session = await WalletAuthService.getSession();
      setUserEmail(session?.user?.email || 'Logged In');
      const st = await SyncEngine.getSettings();
      setSettings(st);
      const count = await OfflineDatabase.getQueueCount();
      setPendingCount(count);
    }
    load();

    const unsubscribe = SyncEngine.subscribe((count, isSyncing) => {
      setPendingCount(count);
      setSyncing(isSyncing);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateMode = async (mode: SyncMode) => {
    const updated = await SyncEngine.updateSettings({ mode });
    setSettings(updated);
  };

  const handleUpdateInterval = async (intervalMinutes: number) => {
    const updated = await SyncEngine.updateSettings({ intervalMinutes });
    setSettings(updated);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Wallet Settings</Text>
      </View>

      {/* Account Profile Card */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>ORGANIZATION ACCOUNT</Text>
        <Text style={styles.profileEmail}>{userEmail}</Text>
        <Text style={styles.profileSubtext}>
          Unified access with OrgFinance web app (Personal Wallet Mode)
        </Text>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={16} color={Colors.expense} />
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
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
              { key: 15, label: '15 mins' },
              { key: 60, label: '1 hour' },
              { key: 360, label: '6 hours' },
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

      {/* About Section */}
      <View style={styles.aboutCard}>
        <Text style={styles.aboutTitle}>OrgWallet v0.1.0</Text>
        <Text style={styles.aboutText}>
          Android-optimized mobile app for OrgFinance Personal Wallet tracking. Built with Expo React Native, Supabase, and SQLite offline synchronization.
        </Text>
      </View>
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
});
