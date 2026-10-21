import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { WalletAuthService } from '@/lib/auth/walletAuth';
import { formatCurrency } from '@/lib/utils/currency';
import { OrgWalletWidget } from '@/widgets/OrgWalletWidget';
import { OrgWalletIosWidget } from '../../../modules/org-wallet-ios-widget';
import React from 'react';
import { Platform, Appearance } from 'react-native';

const WIDGET_OPACITY_KEY = '@orgwallet_widget_opacity';
const WIDGET_LAST_BALANCE_KEY = '@orgwallet_widget_last_balance';
const THEME_STORAGE_KEY = '@orgwallet_theme_mode';
const DEFAULT_OPACITY = 0.85;

export class WidgetService {
  public static async getThemeMode(): Promise<'auto' | 'light' | 'dark'> {
    try {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'auto') {
        return stored;
      }
    } catch (error) {
      console.error('[WidgetService] Error reading theme mode from AsyncStorage:', error);
    }
    return 'auto';
  }

  public static resolveIsDark(themeMode: 'auto' | 'light' | 'dark'): boolean {
    if (themeMode === 'light') return false;
    if (themeMode === 'dark') return true;
    return Appearance.getColorScheme() !== 'light';
  }

  public static async getCachedWidgetState(): Promise<{
    balance: string;
    opacity: number;
    isDark: boolean;
    themeMode: 'auto' | 'light' | 'dark';
  }> {
    const opacity = await this.getOpacity();
    const themeMode = await this.getThemeMode();
    const isDark = this.resolveIsDark(themeMode);
    let balance = 'Loading...';
    try {
      const stored = await AsyncStorage.getItem(WIDGET_LAST_BALANCE_KEY);
      if (stored) {
        balance = stored;
      }
    } catch (err) {
      console.error('[WidgetService] Error reading cached balance:', err);
    }
    return { balance, opacity, isDark, themeMode };
  }

  public static async getOpacity(): Promise<number> {
    try {
      const stored = await AsyncStorage.getItem(WIDGET_OPACITY_KEY);
      if (stored !== null) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 1.0) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('[WidgetService] Error reading opacity from AsyncStorage:', error);
    }
    return DEFAULT_OPACITY;
  }

  public static async setOpacity(opacity: number): Promise<void> {
    try {
      const clamped = Math.min(1.0, Math.max(0.1, opacity));
      await AsyncStorage.setItem(WIDGET_OPACITY_KEY, clamped.toString());
      await this.refreshWidgetData();
    } catch (error) {
      console.error('[WidgetService] Error saving opacity to AsyncStorage:', error);
    }
  }

  public static async getWidgetState(
    organizationId?: string,
    explicitBalance?: number,
    explicitCurrency?: string,
    explicitIsDark?: boolean,
    explicitThemeMode?: 'auto' | 'light' | 'dark'
  ): Promise<{
    balance: string;
    opacity: number;
    isDark: boolean;
    themeMode: 'auto' | 'light' | 'dark';
  }> {
    const opacity = await this.getOpacity();
    const themeMode = explicitThemeMode || (await this.getThemeMode());
    const isDark = typeof explicitIsDark === 'boolean' ? explicitIsDark : this.resolveIsDark(themeMode);
    let balanceStr = '$0.00';

    try {
      let orgId = organizationId;
      if (!orgId) {
        const cached = await WalletAuthService.getCachedOrgIdAsync();
        if (cached) {
          orgId = cached;
        }
      }

      const currency = explicitCurrency || (await WalletAuthService.getCachedCurrencyAsync());

      if (typeof explicitBalance === 'number' && !isNaN(explicitBalance)) {
        balanceStr = formatCurrency(explicitBalance, currency);
        await AsyncStorage.setItem(WIDGET_LAST_BALANCE_KEY, balanceStr);
      } else if (orgId) {
        const accBalances = await OfflineDatabase.getAccountsWithBalances(orgId);
        const totalBalance = accBalances.reduce((sum, b) => sum + (b.current_balance || 0), 0);
        balanceStr = formatCurrency(totalBalance, currency);
        await AsyncStorage.setItem(WIDGET_LAST_BALANCE_KEY, balanceStr);
      } else {
        const cachedBalance = await AsyncStorage.getItem(WIDGET_LAST_BALANCE_KEY);
        if (cachedBalance) {
          balanceStr = cachedBalance;
        }
      }
    } catch (error) {
      console.error('[WidgetService] Error calculating balance:', error);
      try {
        const cachedBalance = await AsyncStorage.getItem(WIDGET_LAST_BALANCE_KEY);
        if (cachedBalance) {
          balanceStr = cachedBalance;
        }
      } catch {}
    }

    return { balance: balanceStr, opacity, isDark, themeMode };
  }

  public static async refreshWidgetData(
    organizationId?: string,
    explicitBalance?: number,
    explicitCurrency?: string,
    explicitIsDark?: boolean,
    explicitThemeMode?: 'auto' | 'light' | 'dark'
  ): Promise<void> {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

    try {
      const { balance, opacity, isDark, themeMode } = await this.getWidgetState(
        organizationId,
        explicitBalance,
        explicitCurrency,
        explicitIsDark,
        explicitThemeMode
      );

      if (Platform.OS === 'android') {
        await requestWidgetUpdate({
          widgetName: 'OrgWalletBalance',
          renderWidget: () => React.createElement(OrgWalletWidget, { balance, opacity, isDark }),
        });
        console.log('[WidgetService] Updated Android home screen widget:', { balance, opacity, isDark });
      } else if (Platform.OS === 'ios') {
        await OrgWalletIosWidget.setWidgetData(balance, opacity, themeMode, isDark);
        console.log('[WidgetService] Updated iOS WidgetKit home screen widget:', { balance, opacity, themeMode, isDark });
      }
    } catch (error) {
      // Ignore if widget is not added to home screen or native widget API is unavailable
      console.log('[WidgetService] Notice during refreshWidgetData:', error);
    }
  }

  public static async clearWidgetData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(WIDGET_LAST_BALANCE_KEY);
      const opacity = await this.getOpacity();
      const themeMode = await this.getThemeMode();
      const isDark = this.resolveIsDark(themeMode);
      if (Platform.OS === 'android') {
        await requestWidgetUpdate({
          widgetName: 'OrgWalletBalance',
          renderWidget: () => React.createElement(OrgWalletWidget, { balance: '$0.00', opacity, isDark }),
        });
      } else if (Platform.OS === 'ios') {
        await OrgWalletIosWidget.clearWidgetData();
      }
    } catch (error) {
      console.log('[WidgetService] Notice during clearWidgetData:', error);
    }
  }
}
