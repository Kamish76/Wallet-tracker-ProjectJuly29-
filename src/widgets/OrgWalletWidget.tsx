import React from 'react';
import { FlexWidget, TextWidget, type ColorProp } from 'react-native-android-widget';

export interface OrgWalletWidgetProps {
  balance: string;
  opacity: number; // 0.10 to 1.00
}

function getAndroidHexColor(opacity: number, baseHex: string = '202020'): ColorProp {
  const clamped = Math.min(1, Math.max(0.1, opacity));
  const alphaHex = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `#${alphaHex}${baseHex}` as ColorProp;
}

export function OrgWalletWidget({ balance = '₱0.00', opacity = 0.85 }: OrgWalletWidgetProps) {
  const backgroundColor = getAndroidHexColor(opacity, '202020');

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor,
        borderRadius: 28,
        paddingHorizontal: 16,
        paddingVertical: 10,
      }}
    >
      {/* Left side: Icon + Account label & Balance */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
        }}
        clickAction="OPEN_URI"
        clickActionData={{
          uri: 'orgwallet://dashboard',
        }}
      >
        <FlexWidget
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <TextWidget
            text="💳"
            style={{
              fontSize: 20,
              color: '#000000',
            }}
          />
        </FlexWidget>

        <FlexWidget
          style={{
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <TextWidget
            text="All accounts"
            style={{
              fontSize: 13,
              color: '#D1D5DB',
            }}
          />
          <TextWidget
            text={balance}
            style={{
              fontSize: 17,
              color: '#FFFFFF',
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Right side: Quick Action Buttons (Expense ↑, Income ↓, Transfer ⇄) */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* Add Expense (Red ↑) */}
        <FlexWidget
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
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
              fontSize: 22,
              color: '#EF4444',
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>

        {/* Divider 1 */}
        <FlexWidget
          style={{
            width: 1,
            height: 22,
            backgroundColor: '#404040',
            marginHorizontal: 4,
          }}
        />

        {/* Add Income (Green ↓) */}
        <FlexWidget
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
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
              fontSize: 22,
              color: '#10B981',
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>

        {/* Divider 2 */}
        <FlexWidget
          style={{
            width: 1,
            height: 22,
            backgroundColor: '#404040',
            marginHorizontal: 4,
          }}
        />

        {/* Add Transfer (Blue ⇄) */}
        <FlexWidget
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
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
              fontSize: 22,
              color: '#3B82F6',
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
