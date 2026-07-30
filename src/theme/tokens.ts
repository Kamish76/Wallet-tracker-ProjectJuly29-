import { Colors } from './colors';

export const Tokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  typography: {
    h1: {
      fontSize: 28,
      fontWeight: '700' as const,
      color: Colors.textWhite,
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: 22,
      fontWeight: '600' as const,
      color: Colors.textWhite,
    },
    h3: {
      fontSize: 18,
      fontWeight: '600' as const,
      color: Colors.textWhite,
    },
    body: {
      fontSize: 15,
      fontWeight: '400' as const,
      color: Colors.textLight,
    },
    caption: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: Colors.textMuted,
    },
  },
  card: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  glassCard: {
    backgroundColor: Colors.glassBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    padding: 16,
  },
};
