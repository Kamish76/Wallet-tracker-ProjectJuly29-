import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase/client';
import { WalletAuthService, extractTokensFromUrl } from '@/lib/auth/walletAuth';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';

export default function AuthCallbackScreen() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const params = useLocalSearchParams();

  useEffect(() => {
    let isMounted = true;

    async function handleAuthCallback() {
      try {
        // 1. Check if Supabase session is already active
        let session = await WalletAuthService.getSession();

        // 2. If not active, inspect initial URL or Linking URL
        if (!session) {
          const url = await Linking.getInitialURL();
          if (url) {
            const { accessToken, refreshToken } = extractTokensFromUrl(url);
            if (accessToken && refreshToken) {
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (error) throw error;
              session = data.session;
            }
          }
        }

        // 3. If still no session, check URL query params from Expo Router
        if (!session && params.access_token && params.refresh_token) {
          const { data, error } = await supabase.auth.setSession({
            access_token: String(params.access_token),
            refresh_token: String(params.refresh_token),
          });
          if (error) throw error;
          session = data.session;
        }

        if (!session) {
          throw new Error('No valid authentication session found from Google Sign-In.');
        }

        // 4. Resolve Personal Wallet and route to Dashboard
        await WalletAuthService.resolveUserWallet(session.user.id);
        if (isMounted) {
          router.replace('/(tabs)/dashboard');
        }
      } catch (err: any) {
        console.error('[AuthCallbackScreen] Error:', err);
        if (isMounted) {
          setErrorMsg(err?.message || 'Authentication failed. Please try again.');
        }
      }
    }

    handleAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [params]);

  return (
    <View style={styles.container}>
      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Sign-In Error</Text>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.backButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.text}>Completing Google Sign-In...</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Tokens.spacing.lg,
  },
  text: {
    marginTop: Tokens.spacing.md,
    color: Colors.textMuted,
    fontSize: Tokens.typography.body.fontSize,
  },
  errorBox: {
    backgroundColor: Colors.surface,
    padding: Tokens.spacing.lg,
    borderRadius: Tokens.radius.md,
    borderColor: Colors.error,
    borderWidth: 1,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  errorTitle: {
    color: Colors.error,
    fontSize: Tokens.typography.h3.fontSize,
    fontWeight: 'bold',
    marginBottom: Tokens.spacing.sm,
  },
  errorText: {
    color: Colors.textWhite,
    fontSize: Tokens.typography.body.fontSize,
    textAlign: 'center',
    marginBottom: Tokens.spacing.md,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Tokens.spacing.sm,
    paddingHorizontal: Tokens.spacing.lg,
    borderRadius: Tokens.radius.sm,
  },
  backButtonText: {
    color: '#000000',
    fontWeight: 'bold',
  },
});
