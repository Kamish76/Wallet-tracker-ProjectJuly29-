#!/usr/bin/env bash
set -e

# OrgWallet - SideStore IPA Packager Script
# This script builds (if Xcode is available) and packages OrgWallet into an .ipa file
# for untethered sideloading via SideStore on iOS.

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WORKSPACE_ROOT"

APP_NAME="OrgWallet"
SCHEME="OrgWallet"
CONFIGURATION="Release"
BUILD_DIR="$WORKSPACE_ROOT/ios/build"
ARCHIVE_PATH="$BUILD_DIR/$APP_NAME.xcarchive"
OUTPUT_IPA="$WORKSPACE_ROOT/$APP_NAME.ipa"

echo "=================================================="
echo "📦 OrgWallet — SideStore IPA Packager"
echo "=================================================="

# Check if xcodebuild is full Xcode or just CommandLineTools
HAS_FULL_XCODE=false
if [ -d "/Applications/Xcode.app/Contents/Developer" ]; then
  export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
  HAS_FULL_XCODE=true
elif xcode-select -p 2>/dev/null | grep -q "Xcode.app"; then
  HAS_FULL_XCODE=true
elif which xcodebuild >/dev/null 2>&1 && xcodebuild -version >/dev/null 2>&1; then
  HAS_FULL_XCODE=true
fi

APP_SOURCE=""

if [ "$HAS_FULL_XCODE" = true ]; then
  echo "🔨 Building fresh Release archive with Xcode (unsigned for SideStore)..."
  rm -rf "$ARCHIVE_PATH"
  mkdir -p "$BUILD_DIR"
  
  xcodebuild -workspace "ios/$APP_NAME.xcworkspace" \
    -scheme "$SCHEME" \
    -configuration "$CONFIGURATION" \
    -sdk iphoneos \
    -archivePath "$ARCHIVE_PATH" \
    IPHONEOS_DEPLOYMENT_TARGET=15.1 \
    CODE_SIGNING_ALLOWED=NO \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGN_IDENTITY="" \
    archive

  APP_SOURCE="$ARCHIVE_PATH/Products/Applications/$APP_NAME.app"
else
  # Fallback if an existing .app or .xcarchive was built on another machine
  if [ -d "$ARCHIVE_PATH/Products/Applications/$APP_NAME.app" ]; then
    APP_SOURCE="$ARCHIVE_PATH/Products/Applications/$APP_NAME.app"
    echo "✓ Found existing archive at: $ARCHIVE_PATH"
  elif [ -d "$BUILD_DIR/Release-iphoneos/$APP_NAME.app" ]; then
    APP_SOURCE="$BUILD_DIR/Release-iphoneos/$APP_NAME.app"
    echo "✓ Found existing build at: $APP_SOURCE"
  else
    echo "⚠️ Full Xcode.app not detected on this Mac (Command Line Tools only)."
    echo ""
    echo "To produce an .ipa for SideStore without local Xcode:"
    echo "  Option 1 (EAS Cloud Build - Recommended):"
    echo "    npx -y eas-cli build -p ios --profile preview"
    echo "    (Downloads the finished .ipa directly to install with SideStore)"
    echo ""
    echo "  Option 2 (Expo Go - Instant Live Testing):"
    echo "    npx expo start"
    echo "    (Scan QR code with iPhone Camera to open in Expo Go instantly)"
    echo ""
    echo "If you have an OrgWallet.app built on another machine or CI,"
    echo "place it in ios/build/Release-iphoneos/ and re-run this script."
    exit 1
  fi
fi

if [ -d "$APP_SOURCE" ]; then
  echo "📦 Packaging $APP_NAME.ipa for SideStore..."
  PAYLOAD_DIR="$WORKSPACE_ROOT/Payload"
  rm -rf "$PAYLOAD_DIR" "$OUTPUT_IPA"
  mkdir -p "$PAYLOAD_DIR"

  cp -R "$APP_SOURCE" "$PAYLOAD_DIR/"

  # Embed App Group entitlements into the Mach-O binaries via ad-hoc codesign so SideStore (AltSign)
  # detects com.apple.security.application-groups and provisions the shared App Group container.
  if [ -d "$PAYLOAD_DIR/$APP_NAME.app/PlugIns/OrgWalletWidgetExtension.appex" ] && [ -f "$WORKSPACE_ROOT/ios/OrgWalletWidget/OrgWalletWidget.entitlements" ]; then
    echo "🔏 Embedding App Group entitlements into OrgWalletWidgetExtension.appex..."
    codesign --force --sign "-" --entitlements "$WORKSPACE_ROOT/ios/OrgWalletWidget/OrgWalletWidget.entitlements" "$PAYLOAD_DIR/$APP_NAME.app/PlugIns/OrgWalletWidgetExtension.appex"
  fi

  if [ -f "$WORKSPACE_ROOT/ios/OrgWallet/OrgWallet.entitlements" ]; then
    echo "🔏 Embedding App Group entitlements into $APP_NAME.app..."
    codesign --force --sign "-" --entitlements "$WORKSPACE_ROOT/ios/OrgWallet/OrgWallet.entitlements" "$PAYLOAD_DIR/$APP_NAME.app"
  fi

  # Create .ipa
  zip -r -q -y "$OUTPUT_IPA" Payload
  rm -rf "$PAYLOAD_DIR"

  echo "=================================================="
  echo "✅ Success! IPA generated at:"
  echo "   $OUTPUT_IPA"
  echo ""
  echo "📲 How to install on your iPhone via SideStore:"
  echo "   1. AirDrop or upload $APP_NAME.ipa to your iPhone."
  echo "   2. Open the SideStore app on your iPhone."
  echo "   3. Tap the '+' icon in 'My Apps' and select $APP_NAME.ipa."
  echo "   4. SideStore will sign and install the app seamlessly!"
  echo "=================================================="
else
  echo "❌ Error: Could not locate $APP_NAME.app to package."
  exit 1
fi
