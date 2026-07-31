import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { OrgWalletWidget } from './OrgWalletWidget';
import { WidgetService } from '@/lib/widget/widgetService';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;

  if (widgetInfo.widgetName === 'OrgWalletBalance') {
    switch (props.widgetAction) {
      case 'WIDGET_ADDED':
      case 'WIDGET_UPDATE':
      case 'WIDGET_RESIZED':
      case 'WIDGET_CLICK':
        // 1. INSTANT initial render using cached balance so the widget never looks empty or disappeared
        try {
          const cached = await WidgetService.getCachedWidgetState();
          props.renderWidget(
            React.createElement(OrgWalletWidget, {
              balance: cached.balance,
              opacity: cached.opacity,
              isLoading: true,
              width: widgetInfo.width,
              height: widgetInfo.height,
            })
          );
        } catch (e) {
          // Ignore cache read errors
        }

        // 2. Fetch fresh live state from SQLite & auth
        try {
          const { balance, opacity } = await WidgetService.getWidgetState();
          props.renderWidget(
            React.createElement(OrgWalletWidget, {
              balance,
              opacity,
              isLoading: false,
              width: widgetInfo.width,
              height: widgetInfo.height,
            })
          );
        } catch (err) {
          console.error('[widgetTaskHandler] Error loading widget state:', err);
        }
        break;
      default:
        break;
    }
  }
}
