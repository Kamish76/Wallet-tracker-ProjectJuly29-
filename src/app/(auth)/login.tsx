import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { WalletAuthService } from '@/lib/auth/walletAuth';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const authData = await WalletAuthService.loginWithEmail(email.trim(), password);
      if (authData.user) {
        await WalletAuthService.resolveUserWallet(authData.user.id);
        router.replace('/(tabs)/dashboard');
      }
    } catch (error: any) {
      const title = error?.name === 'RateLimitError' ? 'Rate Limit Exceeded' : 'Login Failed';
      Alert.alert(title, error?.message || 'Invalid login credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleOAuth = async () => {
    setLoading(true);
    try {
      await WalletAuthService.loginWithGoogle();
      const session = await WalletAuthService.getSession();
      if (session?.user) {
        await WalletAuthService.resolveUserWallet(session.user.id);
        router.replace('/(tabs)/dashboard');
      }
    } catch (error: any) {
      const title = error?.name === 'RateLimitError' ? 'Rate Limit Exceeded' : 'Google Sign-In Error';
      Alert.alert(title, error?.message || 'Failed to connect with Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Branding header matching OrgFinance */}
        <View style={styles.headerContainer}>
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>
            Org<Text style={styles.titleAccent}>Wallet</Text>
          </Text>
          <Text style={styles.subtitle}>
            Unified Access to your OrgFinance Personal Wallet
          </Text>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={Colors.textDim}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={Colors.textDim}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.buttonPrimary}
            onPress={handleEmailLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.buttonPrimaryText}>Sign In to Wallet</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.buttonGoogle}
            onPress={handleGoogleOAuth}
            disabled={loading}
          >
            <Text style={styles.buttonGoogleText}>Continue with Google</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Tokens.spacing.lg,
  },
  headerContainer: {
    marginBottom: Tokens.spacing.xl,
    alignItems: 'center',
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 22,
    marginBottom: Tokens.spacing.md,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.textWhite,
    letterSpacing: -1,
  },
  titleAccent: {
    color: Colors.primary,
  },
  subtitle: {
    ...Tokens.typography.body,
    color: Colors.textMuted,
    marginTop: Tokens.spacing.xs,
    textAlign: 'center',
  },
  card: {
    ...Tokens.card,
    padding: Tokens.spacing.lg,
  },
  label: {
    ...Tokens.typography.caption,
    color: Colors.textLight,
    marginBottom: Tokens.spacing.xs,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Tokens.radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textWhite,
    paddingHorizontal: Tokens.spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: Tokens.spacing.md,
  },
  buttonPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: Tokens.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Tokens.spacing.sm,
  },
  buttonPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Tokens.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    ...Tokens.typography.caption,
    color: Colors.textDim,
    marginHorizontal: Tokens.spacing.md,
  },
  buttonGoogle: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    borderRadius: Tokens.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonGoogleText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textWhite,
  },
});
