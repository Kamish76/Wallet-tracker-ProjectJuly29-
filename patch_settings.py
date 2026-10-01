import re

def fix_settings(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # signOutButton border color
    content = content.replace(
        "borderColor: 'rgba(244, 63, 94, 0.4)',",
        "borderColor: Colors.errorBorder,"
    )

    # previewContainer background
    content = content.replace(
        "backgroundColor: '#0F1117',",
        "backgroundColor: Colors.surfaceCard,"
    )

    # widgetPreviewBanner border color
    content = content.replace(
        "borderColor: 'rgba(255, 255, 255, 0.1)',",
        "borderColor: Colors.border,"
    )

    # widgetPreviewIcon background
    content = content.replace(
        "backgroundColor: '#FFFFFF',",
        "backgroundColor: Colors.textWhite,"
    )

    # widgetPreviewSubtext color
    content = content.replace(
        "color: '#D1D5DB',",
        "color: Colors.textLight,"
    )

    # widgetPreviewBalance color
    content = content.replace(
        "color: '#FFFFFF',",
        "color: Colors.textWhite,"
    )

    # widgetPreviewDivider background
    content = content.replace(
        "backgroundColor: '#404040',",
        "backgroundColor: Colors.borderGlow,"
    )

    # Arrow colors in the TSX (which uses #EF4444, #10B981, #3B82F6)
    content = content.replace("color=\"#EF4444\"", "color={Colors.expense}")
    content = content.replace("color=\"#10B981\"", "color={Colors.income}")
    content = content.replace("color=\"#3B82F6\"", "color={Colors.syncing}")

    with open(filepath, 'w') as f:
        f.write(content)

fix_settings('src/app/(tabs)/settings.tsx')

def fix_widget(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Add Colors import
    content = content.replace(
        "import { FlexWidget, TextWidget, type ColorProp } from 'react-native-android-widget';",
        "import { FlexWidget, TextWidget, type ColorProp } from 'react-native-android-widget';\nimport { Colors } from '@/theme/colors';"
    )

    # Replace arrow text colors
    content = content.replace("color: '#EF4444',", "color: Colors.expense as ColorProp,")
    content = content.replace("color: '#10B981',", "color: Colors.income as ColorProp,")
    content = content.replace("color: '#3B82F6',", "color: Colors.syncing as ColorProp,")

    with open(filepath, 'w') as f:
        f.write(content)

fix_widget('src/widgets/OrgWalletWidget.tsx')

