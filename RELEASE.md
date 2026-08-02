# OrgWallet - Release Notes & Google Play Console Guide (v0.2.0)

This document serves as the official **Release Notes** for **OrgWallet v0.2.0** (and a comprehensive summary of all changes since the initial release v0.1.0) as well as an end-to-end guide for releasing **OrgWallet v0.2.0** on the Google Play Store using Expo Application Services (EAS) and the Google Play Console.

---

## 📋 Table of Contents

1. [Release Notes — OrgWallet v0.2.0 (Live Home Screen Widget & Custom Branding)](#1-release-notes--orgwallet-v020-live-home-screen-widget--custom-branding)
2. [Summary of Changes Since Initial Release (v0.1.0 to v0.2.0)](#2-summary-of-changes-since-initial-release-v010-to-v020)
3. [Prerequisites & EAS Configuration](#3-prerequisites--eas-configuration)
4. [Required Assets for Google Play Console](#4-required-assets-for-google-play-console)
5. [Building the Android App Bundle (.aab)](#5-building-the-android-app-bundle-aab)
6. [Setting Up Google Play Console](#6-setting-up-google-play-console)
7. [Completing App Content & Data Safety](#7-completing-app-content--data-safety)
8. [Publishing to an Initial Testing Track](#8-publishing-to-an-initial-testing-track)
9. [Pre-Flight Verification Checklist](#9-pre-flight-verification-checklist)

---

## 1. Release Notes — OrgWallet v0.2.0 (Live Home Screen Widget & Custom Branding)

**Release Version:** `v0.2.0`  
**Android Version Code:** `2`  
**Release Date:** July 31, 2026  

### 🌟 Overview
**OrgWallet v0.2.0** marks a major leap forward in accessibility, personalization, and brand identity. While **v0.1.0** established our offline-first local SQLite caching engine and Personal Wallet multi-account architecture, **v0.2.0** brings financial tracking directly to the user's Android home screen. With real-time **Net Balance Home Screen Widgets**, **1-Tap Quick Action Shortcuts**, custom **Wallpaper Translucency** controls, and a complete **Visual Branding** overhaul, OrgWallet is faster, more responsive, and more integrated into the Android ecosystem than ever before.

---

### 🔥 Key Highlights in v0.2.0

#### 1. 📱 Live Android Home Screen Widget (`OrgWalletBalance`)
- **Real-Time Balance Display**: Users can now monitor their **Total Net Balance** directly from their Android phone home screen without opening the app.
- **Background Sync Integration**: Powered by custom background task handlers (`widgetTaskHandler.ts` & `widgetService.ts`), the home screen widget automatically refreshes whenever accounts or transactions mutate locally or via background cloud sync.
- **Native Android AnyDPI Layouts**: Designed using native XML and Kotlin/Java bindings (`widget_initial_layout.xml`, `widgetprovider_orgwalletbalance.xml`) for crisp rendering across all screen sizes and launchers.

#### 2. ⚡ 1-Tap Quick Action Shortcuts on Widget
- **Instant Transaction Deep Linking**: The Home Screen Widget features dedicated quick-action buttons for **`+ Expense`**, **`+ Income`**, and **`+ Transfer`**.
- **Dedicated Modal Route (`/action/add-transaction`)**: Tapping any widget shortcut opens OrgWallet directly to a standalone modal with the transaction type pre-selected, enabling users to log financial activity in seconds.

#### 3. 🎨 Custom Wallpaper Translucency & Opacity Slider
- **Tailored Aesthetics**: In the newly added **Settings** screen (`/settings`), users can customize the widget background translucency to blend seamlessly with their phone wallpaper.
- **Interactive Slider & Live Preview**: Features an interactive slider (`@react-native-community/slider`) ranging from 20% to 100% opacity (`0.2` to `1.0`), accompanied by a live on-screen preview card showing real-time formatted balances.

#### 4. ⚙️ Advanced Offline Sync Management (`/settings`)
- **Configurable Sync Modes**: Choose between **Auto** (real-time background sync), **Manual**, or **Scheduled** (every 15 minutes, 60 minutes, or Daily / 24 hours).
- **Conflict Resolution Control**: Users can set their preferred mutation conflict policy (`local_wins`, `server_wins`, or `ask_user`).
- **Queue Monitor & Manual Trigger**: Displays a live counter of pending offline transactions and accounts, with a dedicated **Sync Now** button that provides immediate alert feedback upon completion.

#### 5. 🌟 Full Production Branding & Visual Identity
- **Custom App & Adaptive Launcher Icons**: Replaced all default Expo placeholder graphics with a production **App Icon** (`assets/icon.png`), **Adaptive Launcher Icon** (`assets/adaptive-icon.png`), and **Favicon**.
- **Multi-Density Splash Screen Assets**: Integrated branded splash screen drawables across all Android density buckets (`hdpi`, `mdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`) for a polished startup experience.
- **UI Logo Enhancements**: Added clean brand headers across Auth (`login.tsx`, `callback.tsx`) and Navigation screens.

#### 6. ☕ Native Windows Build & OpenJDK 21 Compatibility Fix
- **Java 25 (Major Version 69) Automated Fix**: Resolved Gradle 8.14.3 incompatibility with Windows system Java 25 (`W:\Dev\JDK`) by configuring `org.gradle.java.home=W:/Dev/Android/Android Studio/jbr` in `android/gradle.properties` to target OpenJDK 21.
- **Production Release Keystore**: Added automated release signing configuration (`release.keystore`) ensuring all `.aab` bundles and `.apk` files are signed in production Release Mode.

---

## 2. Summary of Changes Since Initial Release (v0.1.0 to v0.2.0)

Below is a complete summary of all architectural, functional, and visual changes made from the initial release (`v0.1.0`) through `v0.2.0`:

| Release | Date | Key Capabilities & Changes |
| :--- | :--- | :--- |
| **`v0.2.0`** *(Current)* | **2026-07-31** | • Added Live Android Home Screen Widget (`OrgWalletBalance`) with real-time net balance.<br>• Added Quick Action shortcut buttons on widget (`+ Expense`, `+ Income`, `+ Transfer`) deep-linking to `/action/add-transaction`.<br>• Added comprehensive Settings screen (`/settings`) with Widget Opacity slider and live preview card.<br>• Added Offline Sync Management UI (sync interval selector, conflict resolution policy, queue badge count, manual 'Sync Now').<br>• Integrated production branding assets (`icon.png`, `adaptive-icon.png`, `logo.jpg`, and multi-density splash screen logos).<br>• Applied automated Java 25 -> OpenJDK 21 Gradle binding in `gradle.properties` and production release keystore signing. |
| **`v0.1.0`** *(Initial Beta)* | **2026-07-30** | • Implemented Personal Wallet mode with automatic detection of `[wallet]` metadata markers and default **`Cash`** sub-account creation.<br>• Implemented Local-First SQLite persistence (`orgwallet.db`) for zero-latency offline transaction and account management.<br>• Built background offline sync engine (`SyncEngine`) with `offline_sync_queue` and automatic reconnection recovery.<br>• Implemented accurate multi-sub-account Net Balance calculation engine.<br>• Created Dashboard, Transactions, and Accounts tabs with universal Floating Action Button (FAB) and unified `AddTransactionModal`.<br>• Added sub-account badge attribution (`Cash • 7/30/2026`, `Cash → Savings`) on transaction items.<br>• Resolved Supabase RLS recursion safeguards and PostgreSQL UUID input syntax protection. |

---

## 3. Prerequisites & EAS Configuration

### Step 3.1: Log in with EAS CLI
On Windows PowerShell, use `npx -y eas-cli` (the npm package is named `eas-cli`, not `eas`) to run EAS commands without needing a global installation:
```bash
npx -y eas-cli login
```
*(Optional: If you prefer to install it globally, run `npm install -g eas-cli` first).*

### Step 3.2: EAS Build Configuration (Pre-Configured!)
We have **already created** `eas.json` in your root directory and configured your `production` profile to generate an Android App Bundle (`.aab`):
```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```
*You do not need to run `build:configure` manually!*

### Step 3.3: Verify `app.json` Metadata
Check `app.json` before triggering a build:
- **`android.package`**: `"com.kamish.orgfinance"` (Unique package identifier on Google Play).
- **`version`**: `"0.2.0"` (User-facing version string).
- **`android.versionCode`**: Ensure `"versionCode": 2` is set inside the `android` block. Every time you upload a new `.aab` to Play Console, you **must increment `versionCode` by 1** (e.g., `1` -> `2` -> `3`).

---

## 4. Required Assets for Google Play Console

Even for a beta or production release, Google Play requires mandatory graphical assets before you can publish to any testing or production track.

| Asset Type | Dimensions / Specs | Notes / MVP Recommendations |
| :--- | :--- | :--- |
| **Hi-Res App Icon** | `512 x 512 px` (PNG, 32-bit) | Must have no transparency/alpha for the main Play Store icon. Uses custom `#090A0F` dark aesthetic logo. |
| **Feature Graphic** | `1024 x 500 px` (PNG or JPG) | Displayed at the top of your Play Store listing. Clean banner featuring the OrgWallet logo and tagline (*"Personal & Business Wallet Tracking"*). |
| **Phone Screenshots** | Min 2 screenshots (`1080 x 1920 px` recommended) | Capture at least: <br>1. **Home Screen Widget Screen** (Showing live balance widget with custom opacity) <br>2. **Dashboard Screen** (Net Balance card & Recent Transactions with sub-account badges) <br>3. **Transactions Screen** (Filtered transaction list) <br>4. **Settings Screen** (Widget opacity preview and sync management) |
| **Adaptive Icon** | `1024 x 1024 px` foreground (PNG) | Specified in `app.json` under `android.adaptiveIcon`. |

---

## 5. Building the Android App Bundle (.aab)

Google Play requires **Android App Bundles (`.aab`)** rather than standard APKs for all store submissions.

### Building on Windows PowerShell

Because EAS CLI's `--local` flag requires macOS, Linux, or Windows WSL2, building locally on native **Windows PowerShell** is done using **Native Android Gradle (`gradlew.bat`)**!

#### Method A: Local Windows Build using Native Gradle (`gradlew.bat`) - Recommended for Local
1. **Generate the native Android project folder**:
   ```powershell
   npx expo prebuild --platform android
   ```
2. **Build a standalone APK (`.apk`) to install on your phone**:
   ```powershell
   cd android
   .\gradlew.bat assembleRelease
   ```
   - *Note on build time*: The very first run may take ~10–15 minutes if Gradle needs to download dependencies. Subsequent builds take only 1–2 minutes! **Never use `--verbose`** as it is not a valid Gradle flag (use `--info` or `--debug` if you want verbose logs).
   - Your `.apk` file will be generated at:
     `W:\projects\OrgWallet\android\app\build\outputs\apk\release\app-release.apk`
3. **Build an Android App Bundle (`.aab`) for Google Play Console**:
   ```powershell
   cd android
   .\gradlew.bat bundleRelease
   ```
   - Your `.aab` file will be generated at:
     `W:\projects\OrgWallet\android\app\build\outputs\bundle\release\app-release.aab`

> [!NOTE]
> **Java 25 (Major Version 69) Fix Applied:**
> Your system's default Java is Java 25 (`W:\Dev\JDK`), which Gradle 8.14.3 does not yet support (`Unsupported class file major version 69`). We automatically configured `org.gradle.java.home=W:/Dev/Android/Android Studio/jbr` in your `android/gradle.properties` so Gradle uses Android Studio's bundled OpenJDK 21. If you ever run `expo prebuild --clean` and reset that file, simply re-add `org.gradle.java.home=W:/Dev/Android/Android Studio/jbr` to `android/gradle.properties`.

*(Note on Keystore & Signing: We have automatically generated a production 2048-bit RSA release keystore (`android/app/release.keystore`) and configured `android/app/build.gradle` to use a dedicated `signingConfigs.release` block for all release builds. Your `.aab` bundles and `.apk` files are signed in Release Mode and ready for Google Play Console!)*

---

#### Method B: EAS Cloud Build (No Local Android Studio/JDK Required)
If your laptop does not have Android Studio or Java JDK installed, you can let EAS build in the cloud (no `--local` flag). It takes ~10–15 minutes while you continue other work:
```powershell
# For an installable APK file:
npx -y eas-cli build --platform android --profile preview

# For a Google Play Console AAB bundle:
npx -y eas-cli build --platform android --profile production
```

---

## 6. Setting Up Google Play Console

1. **Developer Registration**: Ensure you have an active [Google Play Developer Account](https://play.google.com/console) ($25 one-time registration fee).
2. **Create New App**:
   - Click **Create app**.
   - **App name**: `OrgWallet` (or your chosen brand name).
   - **Default language**: `English (United States) – en-US`.
   - **App or game**: **App**.
   - **Free or paid**: **Free**.
   - Accept the Developer Program Policies and click **Create app**.

3. **Main Store Listing (Copy & Paste Template)**:
   - Go to **Grow users -> Store presence -> Main store listing** in the left sidebar.
   - Use the following pre-formatted copy for your store listing:

   **App Name (Max 30 characters):**
   ```text
   OrgWallet - Finance Tracker
   ```

   **Short Description (Max 80 characters):**
   ```text
   Live balance Android widgets, personal budgets & organization wealth tracking.
   ```

   **Full Description (Max 4,000 characters):**
   ```text
   OrgWallet is the official mobile companion app for OrgFinance, designed to bring personal wealth tracking and multi-tenant business financial management together in one modern, seamless workspace.

   Whether you are tracking daily coffee expenses in your Personal Wallet or monitoring cash flow across shared organization budgets, OrgWallet gives you real-time visibility and control—wherever you go.

   KEY FEATURES IN v0.2.0:

   • LIVE ANDROID HOME SCREEN WIDGET WITH QUICK ACTIONS
   Check your total net balance and jump straight into logging an Income, Expense, or Transfer from your phone's home screen. Enjoy 1-tap quick action shortcuts without ever navigating through menus.

   • CUSTOM WALLPAPER TRANSLUCENCY & OPACITY CONTROLS
   Customize the home screen widget's background opacity from 20% to 100% in Settings for a sleek, translucent look that blends perfectly with your phone wallpaper.

   • ADVANCED OFFLINE SYNC MANAGEMENT
   Configure automatic background sync, scheduled intervals (15 min, 60 min, Daily), or manual sync triggers. Choose your preferred conflict resolution policy (Local Wins, Server Wins, or Ask User).

   • PERSONAL WALLET MODE
   Effortlessly manage your personal finances with dedicated sub-accounts for Cash, Bank Accounts, Savings, and Credit Cards. Easily log daily income and expenses with automatic balance calculation.

   • MULTI-TENANT WORKSPACES
   Seamlessly switch between your private Personal Wallet and shared business organizations. Collaborate with team members, track group expenses, and maintain separate financial records without cluttering your personal data.

   • OFFLINE-FIRST RELIABILITY
   Built with an ultra-fast local SQLite cache, OrgWallet lets you view balances and log transactions even when you have poor network connectivity. Your changes automatically sync to secure cloud servers the moment you come back online.

   • REAL-TIME SYNCHRONIZATION
   Powered by Supabase cloud infrastructure, your personal wallets and organization ledgers stay perfectly synchronized across your mobile devices and the web dashboard.

   • BANK-GRADE SECURITY & PRIVACY
   Your authentication credentials and tokens are safeguarded using encrypted device secure storage. OrgWallet respects your data privacy with built-in GDPR/CCPA compliance and self-service account deletion tools.

   Take control of your personal wealth and organization finances today with OrgWallet v0.2.0!
   ```

---

## 7. Completing App Content & Data Safety

Before Google allows you to release an app, you must complete the items under **Policy -> App content** in the left sidebar:

### 1. Privacy Policy
- Provide a valid URL to a privacy policy document (required because OrgWallet uses network access and authentication).
- *Tip for MVP*: You can host a free markdown privacy policy page using GitHub Pages or TermsFeed.

### 2. App Access (Reviewer Credentials)
- Since OrgWallet requires authentication, select **"All or some functionality is restricted"**.
- Click **Add new instructions**:
  - Create a dedicated test user account in your production Supabase database (e.g., `reviewer@orgwallet.app` / `TestPassword123!`).
  - Provide these credentials so Google's review team can log in and test the personal wallet flow and widget features.

### 3. Content Rating (IARC Questionnaire)
- Category: **Utility / Productivity / Finance**.
- Answer **No** to violence, gambling, explicit content, and age-restricted material.
- You will receive an **Everyone (PEGI 3)** rating instantly.

### 4. Data Safety Declaration
Declare how OrgWallet handles user data via Supabase:
- **Data Collection**: Yes (email address for authentication, financial transaction entries for wallet balance tracking).
- **Data Sharing**: No data is shared with third parties for marketing/advertising.
- **Security Practices**:
  - Data is encrypted in transit (HTTPS / TLS to Supabase APIs).
  - Users can request deletion of their account and data.

---

## 8. Publishing to an Initial Testing Track

To get the app on your phone and share it with testers immediately without waiting for a lengthy public store review, use **Internal Testing** or **Closed Testing (Beta)**.

### Step 8.1: Create Internal Test Release
1. In Google Play Console, go to **Testing -> Internal testing**.
2. Click **Create new release**.
3. Under **App bundles**, drag and drop your downloaded `.aab` file.
4. Under **Release name**, enter: `0.2.0-beta.1`.
5. Under **Release notes**, paste the summary from `CHANGELOG.md`:
   ```text
   OrgWallet Release v0.2.0 (Live Home Screen Widget & Branding):
   - Live Android Home Screen Widget showing real-time Total Net Balance.
   - Quick Action Shortcuts on widget (+ Expense, + Income, + Transfer) with instant modal deep-linking.
   - Customizable Widget Wallpaper Translucency & Opacity Slider in Settings with live preview.
   - Advanced Offline Sync Management (auto/manual/scheduled intervals, queue counter, 'Sync Now' trigger).
   - Complete Visual Branding with production app icon, adaptive icons, and multi-density splash screens.
   - Java 25 -> OpenJDK 21 Gradle compatibility and automated release keystore signing.
   ```
6. Click **Next**, review any warnings, and click **Save and publish**.

### Step 8.2: Add Testers
- Under the **Testers** tab in **Internal testing**, create an email list containing your Google account email address.
- Copy the **opt-in URL** provided by Google Play Console, open it on your Android device, accept the testing invite, and download OrgWallet directly from the Google Play Store!

---

## 9. Pre-Flight Verification Checklist

Before clicking **Start rollout**, verify all items below:

- [ ] **Environment Variables**: Verify that your `.env.production` or EAS Environment Variables contain production-ready Supabase keys (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
- [ ] **OAuth Redirect URLs**: If using Google OAuth, verify that `orgwallet://auth/callback` and your Expo bundle identifiers are listed in your Google Cloud Console and Supabase Auth URL settings.
- [ ] **Database RLS Policies**: Ensure your Supabase PostgreSQL tables (`organizations`, `wallet_accounts`, `transactions`, `organization_members`) have Row Level Security (RLS) enabled in production.
- [ ] **Home Screen Widget Test**: Add the `OrgWalletBalance` widget to an Android device screen—test clicking quick actions and adjusting opacity in Settings.
- [ ] **Offline SQLite Verification**: Test turning off Wi-Fi/Cellular on a physical device—verify that adding an expense transaction works offline and syncs automatically when reconnected.
- [ ] **Reviewer Test Account**: Confirm that the demo account credentials provided in Play Console can successfully log in and access the Personal Wallet.
