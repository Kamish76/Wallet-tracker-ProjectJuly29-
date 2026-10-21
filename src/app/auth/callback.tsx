import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase/client';
import { WalletAuthService, extractTokensFromUrl } from '@/lib/auth/walletAuth';
import { useTheme } from '@/theme/ThemeContext';
import { Tokens } from '@/theme/tokens';

export default function AuthCallbackScreen() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const params = useLocalSearchParams();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    let isMounted = true;

    async function handleAuthCallback() {
      try {
        // 1. Check if Supabase session is already active
        let session = await WalletAuthService.getSession();
        let retries = 0;
        while (!session && retries < 6) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          session = await WalletAuthService.getSession();
          retries++;
        }

        // 2. If not active, inspect initial URL or Linking URL
        if (!session) {
          const url = Platform.OS === 'web' ? window.location.href : await Linking.getInitialURL();
          if (url) {
            const { accessToken, refreshToken, error: urlError, errorDescription } = extractTokensFromUrl(url);
            if (urlError || errorDescription) {
              throw new Error(errorDescription || urlError || 'Authentication failed');
            }
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {errorMsg ? (
        <View style={[styles.errorBox, { backgroundColor: colors.surface, borderColor: colors.error }]}>
          <Text style={[styles.errorTitle, { color: colors.error }]}>Sign-In Error</Text>
          <Text style={[styles.errorText, { color: colors.textWhite }]}>{errorMsg}</Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={[styles.backButtonText, { color: isDark ? colors.background : '#FFFFFF' }]}>
              Back to Login
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.text, { color: colors.textMuted }]}>Completing Google Sign-In...</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Tokens.spacing.lg,
  },
  text: {
    marginTop: Tokens.spacing.md,
    fontSize: Tokens.typography.body.fontSize,
  },
  errorBox: {
    padding: Tokens.spacing.lg,
    borderRadius: Tokens.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  errorTitle: {
    fontSize: Tokens.typography.h3.fontSize,
    fontWeight: 'bold',
    marginBottom: Tokens.spacing.sm,
  },
  errorText: {
    fontSize: Tokens.typography.body.fontSize,
    textAlign: 'center',
    marginBottom: Tokens.spacing.md,
  },
  backButton: {
    paddingVertical: Tokens.spacing.sm,
    paddingHorizontal: Tokens.spacing.lg,
    borderRadius: Tokens.radius.sm,
  },
  backButtonText: {
    fontWeight: 'bold',
  },
});
