import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { WidgetService } from '@/lib/widget/widgetService';
import { registerBackgroundSync } from '@/lib/sync/backgroundTask';
import NetInfo from '@react-native-community/netinfo';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';

function ThemedRootNavigation() {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Initialize offline SQLite DB
    OfflineDatabase.getDb().catch((e) =>
      console.error('[RootLayout] Failed to initialize SQLite database:', e)
    );

    // Initial check and listener for online status
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      SyncEngine.setNetworkStatus(state.isConnected ?? false);
    });

    // Refresh home screen widget on app launch (Android & iOS)
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      WidgetService.refreshWidgetData().catch(() => {});
    }

    // Register background sync task
    registerBackgroundSync().catch(() => {});

    return () => {
      unsubscribeNetInfo();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <ThemeProvider>
        <ThemedRootNavigation />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
