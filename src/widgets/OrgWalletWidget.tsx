import React from 'react';
import { FlexWidget, TextWidget, type ColorProp } from 'react-native-android-widget';
import { Colors } from '@/theme/colors';

export interface OrgWalletWidgetProps {
  balance: string;
  opacity: number; // 0.10 to 1.00
  isDark?: boolean;
  width?: number;
  height?: number;
  isLoading?: boolean;
}

function getAndroidHexColor(opacity: number, baseHex: string = '202020'): ColorProp {
  const clamped = Math.min(1, Math.max(0.1, opacity));
  const alphaHex = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `#${alphaHex}${baseHex}` as ColorProp;
}

export function OrgWalletWidget({
  balance = '₱0.00',
  opacity = 0.85,
  isDark = true,
  width = 340,
  isLoading = false,
}: OrgWalletWidgetProps) {
  const baseHex = isDark ? '202020' : 'FFFFFF';
  const backgroundColor = getAndroidHexColor(opacity, baseHex);

  // Dynamic responsive styling based on Pixel widget width (dp)
  const isSmall = width < 270; // e.g. 1x3 widget
  const isLarge = width >= 360; // e.g. 1x5 widget

  const iconSize = isSmall ? 22 : isLarge ? 30 : 26;
  const balanceFontSize = isSmall ? 16 : isLarge ? 20 : 18;
  const labelFontSize = isSmall ? 12 : 13;
  const buttonSpacing = isSmall ? 4 : isLarge ? 6 : 5; // Tightened spacing between buttons
  const buttonRadius = isSmall ? 14 : isLarge ? 18 : 16;
  const buttonSize = isSmall ? 44 : isLarge ? 56 : 50; // Bigger square buttons (width === height)

  const displayLabel = isLoading ? 'All accounts • ⌛ Syncing' : 'All accounts';
  const displayBalance = balance === 'Loading...' ? '⌛ Loading...' : balance;

  const labelColor = isLoading ? '#60A5FA' : isDark ? '#D1D5DB' : '#64748B';
  const balanceColor = isLoading && balance === 'Loading...' ? '#93C5FD' : isDark ? '#FFFFFF' : '#0F172A';

  const expenseBg = isDark ? '#2A181C' : '#FFE4E6';
  const expenseColor = (isDark ? Colors.expense : '#E11D48') as ColorProp;

  const incomeBg = isDark ? '#10281F' : '#DCFCE7';
  const incomeColor = (isDark ? Colors.income : '#059669') as ColorProp;

  const transferBg = isDark ? '#142238' : '#DBEAFE';
  const transferColor = (isDark ? Colors.syncing : '#2563EB') as ColorProp;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor,
        borderRadius: 24,
        paddingHorizontal: isSmall ? 12 : 18,
        paddingVertical: 8,
      }}
    >
      {/* Left side: Account label & Balance */}
      <FlexWidget
        style={{
          flex: 1,
          height: 'match_parent',
          flexDirection: 'column',
          justifyContent: 'center',
          marginRight: 8,
        }}
        clickAction="OPEN_URI"
        clickActionData={{
          uri: 'orgwallet://home',
        }}
      >
        <TextWidget
          text={displayLabel}
          style={{
            fontSize: labelFontSize,
            color: labelColor,
            fontWeight: isLoading ? 'bold' : 'normal',
          }}
        />
        <TextWidget
          text={displayBalance}
          style={{
            fontSize: balanceFontSize,
            color: balanceColor,
            fontWeight: 'bold',
          }}
        />
      </FlexWidget>

      {/* Right side: Three square Quick Action buttons */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        {/* Add Expense (Red ↑) */}
        <FlexWidget
          style={{
            width: buttonSize,
            height: buttonSize,
            borderRadius: buttonRadius,
            backgroundColor: expenseBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="OPEN_URI"
          clickActionData={{
            uri: 'orgwallet://add-transaction?type=expense_personal',
          }}
        >
          <TextWidget
            text="↑"
            style={{
              fontSize: iconSize,
              color: expenseColor,
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>

        {/* Add Income (Green ↓) */}
        <FlexWidget
          style={{
            width: buttonSize,
            height: buttonSize,
            marginLeft: buttonSpacing,
            borderRadius: buttonRadius,
            backgroundColor: incomeBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="OPEN_URI"
          clickActionData={{
            uri: 'orgwallet://add-transaction?type=income',
          }}
        >
          <TextWidget
            text="↓"
            style={{
              fontSize: iconSize,
              color: incomeColor,
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>

        {/* Add Transfer (Blue ⇄) */}
        <FlexWidget
          style={{
            width: buttonSize,
            height: buttonSize,
            marginLeft: buttonSpacing,
            borderRadius: buttonRadius,
            backgroundColor: transferBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="OPEN_URI"
          clickActionData={{
            uri: 'orgwallet://add-transaction?type=transfer',
          }}
        >
          <TextWidget
            text="⇄"
            style={{
              fontSize: iconSize,
              color: transferColor,
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
