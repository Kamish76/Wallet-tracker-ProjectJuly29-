import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { OrgWalletWidget } from './OrgWalletWidget';
import { WidgetService } from '@/lib/widget/widgetService';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;

  if (widgetInfo.widgetName === 'OrgWalletBalance') {
    const { balance, opacity } = await WidgetService.getWidgetState();

    switch (props.widgetAction) {
      case 'WIDGET_ADDED':
      case 'WIDGET_UPDATE':
      case 'WIDGET_RESIZED':
      case 'WIDGET_CLICK':
        props.renderWidget(
          React.createElement(OrgWalletWidget, { balance, opacity })
        );
        break;
      default:
        break;
    }
  }
}
