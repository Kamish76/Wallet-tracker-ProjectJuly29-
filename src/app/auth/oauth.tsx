import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';

export default function OAuthRedirectScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>Completing Google Sign-In...</Text>
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
    marginTop: Tokens.spacing.md,
    color: Colors.textMuted,
    fontSize: Tokens.typography.body.fontSize,
  },
});
