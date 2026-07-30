import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { WalletAuthService } from '@/lib/auth/walletAuth';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';

export default function IndexScreen() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuthAndRoute() {
      try {
        const session = await WalletAuthService.getSession();
        if (!session?.user) {
          router.replace('/(auth)/login');
          return;
        }

        // Resolve user wallet organization per Rule #2
        await WalletAuthService.resolveUserWallet(session.user.id);
        router.replace('/(tabs)/dashboard');
      } catch (error) {
        console.error('[IndexScreen] Routing error:', error);
        router.replace('/(auth)/login');
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndRoute();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>Loading OrgWallet...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    ...Tokens.typography.body,
    marginTop: Tokens.spacing.md,
    color: Colors.textMuted,
  },
});
