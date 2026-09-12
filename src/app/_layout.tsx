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
import { Colors } from '@/theme/colors';


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

    // Refresh Android widget on app launch
    if (Platform.OS === 'android') {
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
      <StatusBar style="light" backgroundColor={Colors.background} />
      <View style={styles.container}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: 'fade',
          }}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
