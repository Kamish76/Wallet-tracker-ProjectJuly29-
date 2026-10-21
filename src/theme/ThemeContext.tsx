import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkColors, LightColors, type ThemeColors } from './colors';
import { WidgetService } from '@/lib/widget/widgetService';

export type ThemeMode = 'auto' | 'light' | 'dark';

export const THEME_STORAGE_KEY = '@orgwallet_theme_mode';

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'auto',
  resolvedTheme: 'dark',
  isDark: true,
  colors: DarkColors,
  setThemeMode: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('auto');
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(
    systemColorScheme === 'light' ? 'light' : 'dark'
  );

  // Load persisted theme preference on app start
  useEffect(() => {
    let isMounted = true;
    async function loadTheme() {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'auto') {
          if (isMounted) setThemeModeState(stored);
        }
      } catch (err) {
        console.error('[ThemeContext] Error loading theme from AsyncStorage:', err);
      }
    }
    loadTheme();
    return () => {
      isMounted = false;
    };
  }, []);

  // Listen to OS Appearance changes (especially for 'auto' mode)
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const isSystemDark = colorScheme !== 'light';
      setSystemScheme(isSystemDark ? 'dark' : 'light');
      if (themeMode === 'auto') {
        WidgetService.refreshWidgetData(undefined, undefined, undefined, isSystemDark, 'auto').catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [themeMode]);

  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (themeMode === 'light') return 'light';
    if (themeMode === 'dark') return 'dark';
    return systemScheme;
  }, [themeMode, systemScheme]);

  const isDark = resolvedTheme === 'dark';
  const colors = isDark ? DarkColors : LightColors;

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      const targetIsDark = mode === 'light' ? false : (mode === 'dark' ? true : systemScheme === 'dark');
      // Synchronize widgets on theme update immediately with explicit mode and isDark
      WidgetService.refreshWidgetData(undefined, undefined, undefined, targetIsDark, mode).catch(() => {});
    } catch (err) {
      console.error('[ThemeContext] Error saving themeMode to AsyncStorage:', err);
    }
  }, [systemScheme]);

  const value = useMemo(
    () => ({
      themeMode,
      resolvedTheme,
      isDark,
      colors,
      setThemeMode,
    }),
    [themeMode, resolvedTheme, isDark, colors, setThemeMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
