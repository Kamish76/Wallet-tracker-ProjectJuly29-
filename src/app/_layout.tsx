import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { WidgetService } from '@/lib/widget/widgetService';
import { widgetTaskHandler } from '@/widgets/widgetTaskHandler';
import { Colors } from '@/theme/colors';

if (Platform.OS === 'android') {
  try {
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch (err) {
    console.log('[RootLayout] Notice: widget task handler registration:', err);
  }
}

export default function RootLayout() {
  useEffect(() => {
    // Initialize offline SQLite DB
    OfflineDatabase.getDb().catch((e) =>
      console.error('[RootLayout] Failed to initialize SQLite database:', e)
    );

    // Initial check for online status
    SyncEngine.setNetworkStatus(true);

    // Refresh Android widget on app launch
    if (Platform.OS === 'android') {
      WidgetService.refreshWidgetData().catch(() => {});
    }
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
