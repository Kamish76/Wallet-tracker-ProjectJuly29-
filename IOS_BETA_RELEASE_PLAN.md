# OrgWallet — iOS Beta Release Plan (iPhone XR)

This document provides a comprehensive, production-ready execution plan for building, signing, and installing **OrgWallet** (`com.kamish.orgfinance`) as a beta release onto a physical **iPhone XR**.

---

## 📋 Table of Contents

1. [Executive Summary & Environment Context](#1-executive-summary--environment-context)
2. [Comparison of iOS Installation Paths for iPhone XR](#2-comparison-of-ios-installation-paths-for-iphone-xr)
3. [Pre-Flight Project Configuration Changes](#3-pre-flight-project-configuration-changes)
4. [Path A: EAS Ad-Hoc / Internal Distribution (Direct OTA Install via Safari)](#4-path-a-eas-ad-hoc--internal-distribution-direct-ota-install-via-safari)
5. [Path B: Apple TestFlight Beta (Standard Production-Grade Beta)](#5-path-b-apple-testflight-beta-standard-production-grade-beta)
6. [Path C: Free Apple ID Sideloading (No Paid Developer Account)](#6-path-c-free-apple-id-sideloading-no-paid-developer-account)
7. [Device Setup: Enabling Developer Mode on iPhone XR (iOS 16+)](#7-device-setup-enabling-developer-mode-on-iphone-xr-ios-16)
8. [iPhone XR Hardware & UI Verification Checklist](#8-iphone-xr-hardware--ui-verification-checklist)
9. [Troubleshooting & Common iOS Issues](#9-troubleshooting--common-ios-issues)

---

## 1. Executive Summary & Environment Context

- **App Name:** OrgWallet
- **Current Version:** `0.4.4`
- **Bundle Identifier:** `com.kamish.orgfinance`
- **Target Device:** iPhone XR (A1984 / A2105) — 6.1" Liquid Retina Display (828 × 1792 px, ~326 ppi)
- **Local Host:** macOS (Apple Silicon `darwin-arm64`)
- **EAS CLI:** `eas-cli/24.8.0` (Authenticated as `kamish76` / `jabezrafael1@gmail.com`)
- **EAS Project ID:** `bce79d76-1a02-4bc1-b12e-714c0b46f815`
- **Local Tooling Note:** Only `/Library/Developer/CommandLineTools` is currently active (full `Xcode.app` is not installed). **EAS Cloud Build** will be utilized to compile native iOS binaries in the cloud without needing local Xcode or multi-gigabyte SDK downloads.

---

## 2. Comparison of iOS Installation Paths for iPhone XR

Unlike Android, where `.apk` files can be freely installed via direct download without signatures, iOS enforces cryptographic code signing on physical hardware. Review the three available paths to choose the one that matches your Apple credentials:

| Feature / Requirement | Path A: EAS Ad-Hoc Internal (Recommended) | Path B: Apple TestFlight | Path C: Sideloadly / AltStore |
| :--- | :--- | :--- | :--- |
| **Best For** | Instant private testing on your specific iPhone XR | Multi-user beta testing & store prep | Testing without paid Apple Developer Account |
| **Apple Account Needed** | Paid Apple Developer Program ($99/yr) | Paid Apple Developer Program ($99/yr) | **Free Apple ID** (No fee) |
| **Device Registration** | iPhone XR UDID must be registered in Apple Portal | No UDID registration required | No UDID registration required |
| **Installation Method** | Scan QR code in iPhone XR Safari (Over-the-Air) | TestFlight App from iOS App Store | USB Lightning Cable to Mac |
| **Build Expiration** | 1 year (provisioning profile lifespan) | 90 days per build | 7 days (must re-sign weekly) |
| **EAS Profile** | `preview` (`distribution: "internal"`) | `production` (`distribution: "store"`) | `preview` (download `.ipa` then sideload) |

> [!TIP]
> **Recommendation:**
> - If you have an active **Apple Developer Program** membership, use **Path A** for the fastest single-device install (scan QR code in Safari on your iPhone XR).
> - If you want the seamless official Apple testing workflow with crash reporting and team invites, use **Path B (TestFlight)**.
> - If you do not have a paid Apple Developer account, use **Path C (Sideloadly)** with your free Apple ID.

---

## 3. Pre-Flight Project Configuration Changes

Before initiating any iOS build, two configuration files in the project root must be updated to ensure compliance with Apple's bundle requirements and EAS internal distribution rules.

### 3.1 Update `app.json`

Apple requires every iOS release to specify a `buildNumber` (`CFBundleVersion`) in addition to `version` (`CFBundleShortVersionString`). Also, declaring `ITSAppUsesNonExemptEncryption: false` prevents App Store Connect from prompting for export compliance documentation on every build.

```json
{
  "expo": {
    "name": "OrgWallet",
    "slug": "orgwallet",
    "version": "0.4.4",
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.kamish.orgfinance",
      "buildNumber": "9",
      "icon": "./assets/icon.png",
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
    }
  }
}
```

### 3.2 Update `eas.json`

Ensure `eas.json` has an iOS build definition under `preview` that outputs a physical device `.ipa` (`"simulator": false`), and an iOS configuration under `production`:

```json
{
  "cli": {
    "version": ">= 10.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true,
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### 3.3 Platform Guarding Audit

Verify that Android-only native dependencies do not execute or break during iOS runtime:
- `react-native-android-widget`: Safe! OrgWallet's `src/lib/widget/widgetService.ts` already has `if (Platform.OS !== 'android') return;` and the library provides a safe JavaScript `noopModule` when running on iOS.
- `expo-sqlite`: SQLite concurrency locks (`withLock`) and connection management operate seamlessly on iOS native Core Data/SQLite bridges.
- Safe Area insets: `src/app/(tabs)/_layout.tsx` dynamically clamps tab bar height with `useSafeAreaInsets()`, ensuring full clearance of the iPhone XR bottom Home Indicator bar.

---

## 4. Path A: EAS Ad-Hoc / Internal Distribution (Direct OTA Install via Safari)

This path produces a signed `.ipa` that can be installed directly over-the-air from the web on your iPhone XR.

### Step 1: Register the iPhone XR UDID with EAS

To install an ad-hoc build, Apple requires the device's Unique Device Identifier (UDID) to be included in the embedded provisioning profile.

1. On your Mac terminal, run:
   ```bash
   npx -y eas-cli device:create
   ```
2. The CLI will generate a registration URL and a QR code.
3. Open the **Camera** on your iPhone XR, point it at the QR code, and tap the link to open in **Mobile Safari**.
4. Safari will prompt: *"This website is trying to download a configuration profile. Do you want to allow this?"* Tap **Allow**.
5. Go to your iPhone XR **Settings** > **Profile Downloaded** (near the top) > Tap **Install** > Enter your device passcode.
6. The profile registers your iPhone XR's UDID with your Expo EAS account and your Apple Developer account automatically.

### Step 2: Trigger the Cloud iOS Preview Build

Run the following command on your Mac:

```bash
npx -y eas-cli build -p ios --profile preview
```

**During the build prompt:**
- When asked: *"Do you want EAS to manage your Apple credentials?"*, select **Yes** (EAS will automatically generate the distribution certificate and provisioning profile including your registered iPhone XR).
- Log in with your Apple ID credentials when requested by the CLI.

### Step 3: Install on your iPhone XR

1. Once the EAS build completes (typically 8–15 minutes on EAS cloud builders), the CLI displays a build URL and a QR code.
2. Open the **Camera app** on your iPhone XR and scan the QR code (or open the build link in Safari).
3. Tap **Install OrgWallet**.
4. The OrgWallet app icon will appear on your iPhone XR Home Screen and begin downloading.

---

## 5. Path B: Apple TestFlight Beta (Standard Production-Grade Beta)

If you prefer using Apple's official TestFlight system:

### Step 1: Create the App in App Store Connect
1. Navigate to [App Store Connect](https://appstoreconnect.apple.com/apps).
2. Click **+** > **New App**.
3. Set **Platform:** `iOS`, **Name:** `OrgWallet`, **Primary Language:** `English`, **Bundle ID:** `com.kamish.orgfinance`, **SKU:** `orgwallet-ios`.

### Step 2: Build & Auto-Submit to TestFlight
Run:

```bash
npx -y eas-cli build -p ios --profile production --auto-submit
```
*(Or alternatively run `npx testflight`)*

EAS will build the iOS archive (`.xcarchive`), sign it with an App Store distribution certificate, and upload it directly to App Store Connect.

### Step 3: Add Yourself as an Internal Tester
1. In App Store Connect, go to **Apps** > **OrgWallet** > **TestFlight** tab.
2. Under **Internal Testing**, click **+** to add a group (e.g. `Developers`).
3. Add your Apple ID email.
4. Internal testers do not require Apple Beta App Review—builds become available immediately once Apple finishes processing (usually 5–15 minutes).

### Step 4: Install via TestFlight App
1. On your iPhone XR, open the **App Store** and install the **TestFlight** app (by Apple).
2. Open TestFlight and sign in with your Apple ID.
3. Accept the OrgWallet beta invitation and tap **Install**.

---

## 6. Path C: Free Apple ID Sideloading (No Paid Developer Account)

If you do not have an active $99/year Apple Developer membership, you can sideload the build directly onto your iPhone XR using **Sideloadly** and your personal Apple ID.

### Step 1: Build the Ad-Hoc `.ipa` File
Configure `eas.json` for internal distribution, then run:

```bash
npx -y eas-cli build -p ios --profile preview
```
When the build finishes, download the generated `.ipa` file from the EAS build dashboard onto your Mac.

### Step 2: Install Sideloadly on macOS
1. Download and install [Sideloadly](https://sideloadly.io/) on your Mac.
2. Launch Sideloadly.

### Step 3: Sideload onto iPhone XR via USB
1. Connect your iPhone XR to your Mac using a **Lightning to USB / USB-C cable**.
2. If prompted on your iPhone XR, tap **Trust This Computer** and enter your passcode.
3. In Sideloadly:
   - Select your connected **iPhone XR** under *Device*.
   - Drag and drop the downloaded OrgWallet `.ipa` into the IPA icon area.
   - Enter your **Apple ID** in the Apple ID field.
   - Click **Start**.
4. Sideloadly will re-sign the app with your personal free certificate and push it directly onto your iPhone XR.

> [!NOTE]
> Free Apple ID sideloaded apps expire after **7 days**. To continue using the beta after 7 days, reconnect to your Mac and re-run Sideloadly or re-sign via AltStore/SideStore.

---

## 7. Device Setup: Enabling Developer Mode on iPhone XR (iOS 16+)

Starting with iOS 16, Apple requires physical devices to explicitly enable **Developer Mode** before running ad-hoc or sideloaded apps.

### How to Enable Developer Mode:
1. On your iPhone XR, open **Settings**.
2. Scroll down and tap **Privacy & Security**.
3. Scroll to the very bottom and tap **Developer Mode**.
4. Toggle the switch to **On**.
5. Tap **Restart** when prompted by iOS.
6. After your iPhone XR restarts and you unlock it, a system alert will appear: *"Turn On Developer Mode?"* Tap **Turn On** and enter your device passcode.

### How to Trust Enterprise / Developer Certificate:
When tapping the OrgWallet app icon for the first time on ad-hoc / sideloaded installs:
1. If you see *"Untrusted Developer"* or *"Untrusted Enterprise Developer"*:
2. Go to **Settings** > **General** > **VPN & Device Management**.
3. Under *Developer App*, tap your Apple ID / Developer Profile.
4. Tap **Trust "[Your Profile Name]"** > Confirm **Trust**.
5. Return to the Home Screen and open OrgWallet.

---

## 8. iPhone XR Hardware & UI Verification Checklist

Once OrgWallet is installed and launching on the iPhone XR, verify all platform-specific and hardware-specific behaviors:

### 📱 Display & Layout (Liquid Retina 6.1", 828 × 1792)
- [ ] **Top Notch Clearance:** Header titles and sync status bar must render cleanly below the sensor notch (safe area top inset ~44pt).
- [ ] **Bottom Home Indicator Clearance:** The custom bottom tab bar (`MaterialTopTabs`) must have sufficient padding so tab icons and labels do not clash with the Home Indicator swipe bar (safe area bottom inset ~34pt).
- [ ] **Modal Sheets:** Verify that the Add Transaction and Edit Transaction bottom sheets animate smoothly without clipping off-screen.
- [ ] **Virtual Keyboard & Keypad:** Ensure the custom numeric keypad in the transaction modal does not overlap the submit button or leave dead zones.

### 💾 Data & Offline Persistence
- [ ] **SQLite Initialization:** Local tables (`wallet_accounts`, `transactions`, `transaction_categories`) initialize without file locking or permission errors in the iOS sandbox.
- [ ] **Biometrics / SecureStore:** Verify that session credentials saved to iOS Keychain via `expo-secure-store` persist across app force-quits.
- [ ] **Offline Sync Engine:** Test toggling Airplane Mode on iPhone XR to verify offline transaction queueing and automatic sync recovery upon reconnecting to Wi-Fi/Cellular.

---

## 9. Troubleshooting & Common iOS Issues

### 1. "Unable to Install OrgWallet" (Ad-Hoc Build)
- **Cause:** The iPhone XR's UDID is missing from the mobile provisioning profile embedded inside the `.ipa`.
- **Solution:** Re-run `npx -y eas-cli device:create` from your Mac, scan the link on the iPhone XR to install the profile, and then trigger a rebuild with `npx -y eas-cli build -p ios --profile preview --clear-cache`.

### 2. Missing Export Compliance (App Store Connect / TestFlight)
- **Error:** *"Missing Compliance: App cannot be tested until encryption compliance is answered."*
- **Solution:** Ensure `expo.ios.infoPlist.ITSAppUsesNonExemptEncryption: false` is added in `app.json`.

### 3. "No accounts found with the given Apple ID"
- **Cause:** Two-factor authentication (2FA) session expired on EAS credentials.
- **Solution:** Run `npx -y eas-cli credentials -p ios` to refresh the Apple Developer session and re-authenticate.

### 4. Build Fails with CocoaPods / Architecture Error on Cloud
- **Solution:** Clean EAS build cache and force fresh pod resolution:
  ```bash
  npx -y eas-cli build -p ios --profile preview --clear-cache
  ```

---

## 10. Next Execution Steps

When you are ready to begin, follow this sequence:
1. Apply the recommended `buildNumber` and `ITSAppUsesNonExemptEncryption` additions to `app.json`.
2. Ensure the `preview` profile in `eas.json` has `"ios": { "simulator": false }`.
3. Choose your path (**Path A** for fast direct QR install via Safari, or **Path C** if using a free Apple ID).
4. Run `npx -y eas-cli device:create` to link your iPhone XR.
5. Launch the build with `npx -y eas-cli build -p ios --profile preview`.
