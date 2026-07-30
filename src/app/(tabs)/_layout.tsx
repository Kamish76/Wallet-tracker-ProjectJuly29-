import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { LayoutDashboard, ArrowRightLeft, Wallet, Settings, Wifi, WifiOff, RefreshCw } from 'lucide-react-native';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';

export default function TabsLayout() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = SyncEngine.subscribe((count, syncing) => {
      setPendingCount(count);
      setIsSyncing(syncing);
      setIsOnline(SyncEngine.getOnlineStatus());
    });
    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      {/* Top Sync Bar Indicator */}
      <View style={styles.syncBar}>
        <View style={styles.syncStatusLeft}>
          {isOnline ? (
            <Wifi size={14} color={Colors.online} />
          ) : (
            <WifiOff size={14} color={Colors.offline} />
          )}
          <Text style={styles.syncStatusText}>
            {isOnline ? 'Connected' : 'Offline Mode (Local Storage)'}
          </Text>
        </View>
        <View style={styles.syncStatusRight}>
          {isSyncing && <RefreshCw size={14} color={Colors.syncing} />}
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount} pending</Text>
            </View>
          )}
        </View>
      </View>

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textDim,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: 'Transactions',
            tabBarIcon: ({ color, size }) => <ArrowRightLeft color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="accounts"
          options={{
            title: 'Accounts',
            tabBarIcon: ({ color, size }) => <Wallet color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => <Settings color={color} size={22} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  syncBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Tokens.spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  syncStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncStatusText: {
    ...Tokens.typography.caption,
    color: Colors.textMuted,
    marginLeft: 6,
  },
  syncStatusRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: Tokens.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.background,
  },
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
