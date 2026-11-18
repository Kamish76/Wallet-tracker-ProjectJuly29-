import React, { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialTopTabs } from '@/components/MaterialTopTabs';
import { View, Text, StyleSheet } from 'react-native';
import { LayoutDashboard, ArrowRightLeft, Wallet, Settings, Wifi, WifiOff, RefreshCw } from 'lucide-react-native';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { useTheme } from '@/theme/ThemeContext';
import { Tokens } from '@/theme/tokens';

export default function TabsLayout() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const { colors, isDark } = useTheme();

  const insets = useSafeAreaInsets();
  const paddingBottom = Math.max(14, insets.bottom);
  const syncBarPaddingTop = Math.max(insets.top, 6);
  const tabBarHeight = 68 + paddingBottom;

  useEffect(() => {
    const unsubscribe = SyncEngine.subscribe((count, syncing) => {
      setPendingCount(count);
      setIsSyncing(syncing);
      setIsOnline(SyncEngine.getOnlineStatus());
    });
    return () => unsubscribe();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Sync Bar Indicator */}
      <View
        style={[
          styles.syncBar,
          {
            paddingTop: syncBarPaddingTop,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.syncStatusLeft}>
          {isOnline ? (
            <Wifi size={14} color={colors.online} />
          ) : (
            <WifiOff size={14} color={colors.offline} />
          )}
          <Text style={[styles.syncStatusText, { color: colors.textMuted }]}>
            {isOnline ? 'Connected' : 'Offline Mode (Local Storage)'}
          </Text>
        </View>
        <View style={styles.syncStatusRight}>
          {isSyncing && <RefreshCw size={14} color={colors.syncing} />}
          {pendingCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.badgeText, { color: isDark ? colors.background : '#FFFFFF' }]}>
                {pendingCount} pending
              </Text>
            </View>
          )}
        </View>
      </View>

      <MaterialTopTabs
        tabBarPosition="bottom"
        screenOptions={{
          tabBarStyle: [
            styles.tabBar,
            {
              height: tabBarHeight,
              paddingBottom,
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ],
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textDim,
          tabBarLabelStyle: styles.tabLabel,
          tabBarShowIcon: true,
          tabBarIndicatorStyle: { backgroundColor: 'transparent' }, // hide top indicator line
          swipeEnabled: true,
          animationEnabled: true,
        }}
      >
        <MaterialTopTabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={25} />,
          }}
        />
        <MaterialTopTabs.Screen
          name="transactions"
          options={{
            title: 'Transactions',
            tabBarIcon: ({ color }) => <ArrowRightLeft color={color} size={25} />,
          }}
        />
        <MaterialTopTabs.Screen
          name="accounts"
          options={{
            title: 'Accounts',
            tabBarIcon: ({ color }) => <Wallet color={color} size={25} />,
          }}
        />
        <MaterialTopTabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => <Settings color={color} size={25} />,
          }}
        />
      </MaterialTopTabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  syncBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Tokens.spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  syncStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncStatusText: {
    ...Tokens.typography.caption,
    marginLeft: 6,
  },
  syncStatusRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    borderRadius: Tokens.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tabBar: {
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
