export const DarkColors = {
  // Primary dark background palette matching OrgFinance
  background: '#090A0F',
  surface: '#12141F',
  surfaceElevated: '#1A1D2D',
  surfaceCard: '#151828',
  border: '#282C40',
  borderGlow: '#3B4160',

  // Vibrant accent tokens
  primary: '#00F2FE',       // Neon Cyan
  primaryDark: '#00B8D4',
  secondary: '#4FACFE',     // Sky Blue / Electric Cyan gradient partner
  accentPurple: '#8A2BE2',  // Vibrant Neon Purple

  // Semantic transaction colors
  income: '#10B981',        // Emerald Green
  incomeBg: 'rgba(16, 185, 129, 0.12)',
  expense: '#F43F5E',       // Rose Red
  expenseBg: 'rgba(244, 63, 94, 0.12)',
  transfer: '#6366F1',      // Indigo
  transferBg: 'rgba(99, 102, 241, 0.12)',

  // Text colors
  textWhite: '#FFFFFF',
  textLight: '#E2E8F0',
  textMuted: '#94A3B8',
  textDim: '#64748B',

  // Status & Badge indicators
  online: '#10B981',
  offline: '#F59E0B',       // Amber
  syncing: '#3B82F6',       // Blue
  error: '#EF4444',
  errorBg: 'rgba(239, 68, 68, 0.12)',
  errorBorder: 'rgba(239, 68, 68, 0.3)',
  success: '#10B981',

  // Overlays
  overlay: 'rgba(9, 10, 15, 0.85)',
  glassBg: 'rgba(21, 24, 40, 0.75)',
};

export const LightColors: typeof DarkColors = {
  // Crisp light palette
  background: '#F8FAFC',     // Slate 50
  surface: '#FFFFFF',        // Pure White
  surfaceElevated: '#F1F5F9',// Slate 100
  surfaceCard: '#FFFFFF',    // White cards
  border: '#E2E8F0',         // Slate 200
  borderGlow: '#CBD5E1',     // Slate 300

  // High-contrast vibrant accents on light canvas
  primary: '#0284C7',        // Sky 600 (readable on white)
  primaryDark: '#0369A1',    // Sky 700
  secondary: '#0EA5E9',      // Sky 500
  accentPurple: '#7C3AED',   // Violet 600

  // Semantic transaction colors
  income: '#059669',         // Emerald 600
  incomeBg: 'rgba(5, 150, 105, 0.10)',
  expense: '#E11D48',        // Rose 600
  expenseBg: 'rgba(225, 29, 72, 0.10)',
  transfer: '#4F46E5',       // Indigo 600
  transferBg: 'rgba(79, 70, 229, 0.10)',

  // Text colors (textWhite maps to high-emphasis slate 900 in light mode for 100% token compatibility)
  textWhite: '#0F172A',      // Slate 900 (High contrast primary text)
  textLight: '#334155',      // Slate 700
  textMuted: '#64748B',      // Slate 500
  textDim: '#94A3B8',        // Slate 400

  // Status & Badge indicators
  online: '#059669',
  offline: '#D97706',        // Amber 600
  syncing: '#2563EB',        // Blue 600
  error: '#DC2626',          // Red 600
  errorBg: 'rgba(220, 38, 38, 0.10)',
  errorBorder: 'rgba(220, 38, 38, 0.25)',
  success: '#059669',

  // Overlays
  overlay: 'rgba(15, 23, 42, 0.60)',
  glassBg: 'rgba(255, 255, 255, 0.85)',
};

export type ThemeColors = typeof DarkColors;
export const Colors = DarkColors;
