import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { WalletAuthService } from '@/lib/auth/walletAuth';
import { calculateTotalNetBalance } from '@/lib/utils/balance';
import { OrgWalletWidget } from '@/widgets/OrgWalletWidget';
import React from 'react';
import { Platform } from 'react-native';

const WIDGET_OPACITY_KEY = '@orgwallet_widget_opacity';
const WIDGET_LAST_BALANCE_KEY = '@orgwallet_widget_last_balance';
const DEFAULT_OPACITY = 0.85;

export class WidgetService {
  public static async getCachedWidgetState(): Promise<{
    balance: string;
    opacity: number;
  }> {
    const opacity = await this.getOpacity();
    let balance = 'Loading...';
    try {
      const stored = await AsyncStorage.getItem(WIDGET_LAST_BALANCE_KEY);
      if (stored) {
        balance = stored;
      }
    } catch (err) {
      console.error('[WidgetService] Error reading cached balance:', err);
    }
    return { balance, opacity };
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

  public static async getWidgetState(organizationId?: string): Promise<{
    balance: string;
    opacity: number;
  }> {
    const opacity = await this.getOpacity();
    let balanceStr = '$0.00';

    try {
      let orgId = organizationId;
      if (!orgId) {
        const session = await WalletAuthService.getSession();
        if (session?.user?.id) {
          const res = await WalletAuthService.resolveUserWallet(session.user.id);
          orgId = res.organizationId;
        }
      }

      if (orgId) {
        const accounts = await OfflineDatabase.getAccounts(orgId);
        const transactions = await OfflineDatabase.getTransactions(orgId, 500);
        const totalBalance = calculateTotalNetBalance(accounts, transactions);
        balanceStr = '$' + totalBalance.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        await AsyncStorage.setItem(WIDGET_LAST_BALANCE_KEY, balanceStr);
      }
    } catch (error) {
      console.error('[WidgetService] Error calculating balance:', error);
    }

    return { balance: balanceStr, opacity };
  }

  public static async refreshWidgetData(organizationId?: string): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      const { balance, opacity } = await this.getWidgetState(organizationId);

      await requestWidgetUpdate({
        widgetName: 'OrgWalletBalance',
        renderWidget: () => React.createElement(OrgWalletWidget, { balance, opacity }),
      });
      console.log('[WidgetService] Updated Android home screen widget:', { balance, opacity });
    } catch (error) {
      // Ignore if widget is not added to home screen or Android widget API is unavailable
      console.log('[WidgetService] Notice during requestWidgetUpdate:', error);
    }
  }
}
