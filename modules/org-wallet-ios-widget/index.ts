import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export const IOS_APP_GROUP = 'group.com.kamish.orgfinance';

interface OrgWalletIosWidgetNativeModule {
  setWidgetData(balance: string, opacity: number, appGroup?: string): Promise<boolean>;
  clearWidgetData(appGroup?: string): Promise<boolean>;
  reloadWidget(): Promise<boolean>;
}

const nativeModule: OrgWalletIosWidgetNativeModule | null =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<OrgWalletIosWidgetNativeModule>('OrgWalletIosWidget')
    : null;

export class OrgWalletIosWidget {
  public static async setWidgetData(
    balance: string,
    opacity: number,
    appGroup: string = IOS_APP_GROUP
  ): Promise<boolean> {
    if (Platform.OS !== 'ios' || !nativeModule) {
      return false;
    }
    try {
      return await nativeModule.setWidgetData(balance, opacity, appGroup);
    } catch (error) {
      console.log('[OrgWalletIosWidget] Notice during setWidgetData:', error);
      return false;
    }
  }

  public static async clearWidgetData(appGroup: string = IOS_APP_GROUP): Promise<boolean> {
    if (Platform.OS !== 'ios' || !nativeModule) {
      return false;
    }
    try {
      return await nativeModule.clearWidgetData(appGroup);
    } catch (error) {
      console.log('[OrgWalletIosWidget] Notice during clearWidgetData:', error);
      return false;
    }
  }

  public static async reloadWidget(): Promise<boolean> {
    if (Platform.OS !== 'ios' || !nativeModule) {
      return false;
    }
    try {
      return await nativeModule.reloadWidget();
    } catch (error) {
      console.log('[OrgWalletIosWidget] Notice during reloadWidget:', error);
      return false;
    }
  }
}
