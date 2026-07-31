import React from 'react';
import { FlexWidget, TextWidget, type ColorProp } from 'react-native-android-widget';

export interface OrgWalletWidgetProps {
  balance: string;
  opacity: number; // 0.10 to 1.00
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
  width = 340,
  isLoading = false,
}: OrgWalletWidgetProps) {
  const backgroundColor = getAndroidHexColor(opacity, '202020');

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
  const balanceColor = isLoading && balance === 'Loading...' ? '#93C5FD' : '#FFFFFF';

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
      {/* Left side: Account label & Balance (no credit card icon) */}
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
          uri: 'orgwallet://dashboard',
        }}
      >
        <TextWidget
          text={displayLabel}
          style={{
            fontSize: labelFontSize,
            color: isLoading ? '#60A5FA' : '#D1D5DB',
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

      {/* Right side: Three bigger equally square Quick Action buttons with lesser space between them */}
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
            backgroundColor: '#2A181C',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="OPEN_URI"
          clickActionData={{
            uri: 'orgwallet://dashboard?type=expense_personal',
          }}
        >
          <TextWidget
            text="↑"
            style={{
              fontSize: iconSize,
              color: '#EF4444',
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
            backgroundColor: '#10281F',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="OPEN_URI"
          clickActionData={{
            uri: 'orgwallet://dashboard?type=income',
          }}
        >
          <TextWidget
            text="↓"
            style={{
              fontSize: iconSize,
              color: '#10B981',
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
            backgroundColor: '#142238',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="OPEN_URI"
          clickActionData={{
            uri: 'orgwallet://dashboard?type=transfer',
          }}
        >
          <TextWidget
            text="⇄"
            style={{
              fontSize: iconSize,
              color: '#3B82F6',
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
