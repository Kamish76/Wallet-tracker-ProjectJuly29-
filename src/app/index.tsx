import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { WalletAuthService } from '@/lib/auth/walletAuth';
import { useTheme } from '@/theme/ThemeContext';
import { Tokens } from '@/theme/tokens';

export default function IndexScreen() {
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();

  useEffect(() => {
    async function checkAuthAndRoute() {
      try {
        const session = await WalletAuthService.getSession();
        if (!session?.user) {
          await WalletAuthService.clearAllUserData();
          router.replace('/(auth)/login');
          return;
        }

        // Resolve user wallet organization per Rule #2
        await WalletAuthService.resolveUserWallet(session.user.id);
        router.replace('/(tabs)/dashboard');
      } catch (error) {
        console.error('[IndexScreen] Routing error or session expired:', error);
        await WalletAuthService.clearAllUserData();
        router.replace('/(auth)/login');
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndRoute();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.text, { color: colors.textMuted }]}>Loading OrgWallet...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    ...Tokens.typography.body,
    marginTop: Tokens.spacing.md,
  },
});
