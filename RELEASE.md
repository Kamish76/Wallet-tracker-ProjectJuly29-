# OrgWallet - Google Play Console Release Guide (v0.1.0)

This document provides a comprehensive, end-to-end guide for releasing **OrgWallet v0.1.0 (Initial Beta)** on the Google Play Store using Expo Application Services (EAS) and the Google Play Console.

---

## 📋 Table of Contents

1. [Prerequisites & EAS Configuration](#1-prerequisites--eas-configuration)
2. [Required Assets for Google Play Console](#2-required-assets-for-google-play-console)
3. [Building the Android App Bundle (.aab)](#3-building-the-android-app-bundle-aab)
4. [Setting Up Google Play Console](#4-setting-up-google-play-console)
5. [Completing App Content & Data Safety](#5-completing-app-content--data-safety)
6. [Publishing to an Initial Testing Track](#6-publishing-to-an-initial-testing-track)
7. [Pre-Flight Verification Checklist](#7-pre-flight-verification-checklist)

---

## 1. Prerequisites & EAS Configuration

### Step 1.1: Log in with EAS CLI
On Windows PowerShell, use `npx -y eas-cli` (the npm package is named `eas-cli`, not `eas`) to run EAS commands without needing a global installation:
```bash
npx -y eas-cli login
```
*(Optional: If you prefer to install it globally, run `npm install -g eas-cli` first).*

### Step 1.2: EAS Build Configuration (Pre-Configured!)
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
### Step 1.3: Verify `app.json` Metadata
Check `app.json` before triggering a build:
- **`android.package`**: `"com.kamish.orgfinance"` (Unique package identifier on Google Play).
- **`version`**: `"0.1.0"` (User-facing version string).
- **`android.versionCode`**: Ensure `"versionCode": 1` is set inside the `android` block. Every time you upload a new `.aab` to Play Console, you **must increment `versionCode` by 1** (e.g., `1` -> `2` -> `3`).

---

## 2. Required Assets for Google Play Console

Even for an initial beta or MVP release, Google Play requires mandatory graphical assets before you can publish to any testing or production track.

| Asset Type | Dimensions / Specs | Notes / MVP Recommendations |
| :--- | :--- | :--- |
| **Hi-Res App Icon** | `512 x 512 px` (PNG, 32-bit) | Must have no transparency/alpha for the main Play Store icon. For now, you can use a stylized icon with the `#090A0F` dark background and app initials. |
| **Feature Graphic** | `1024 x 500 px` (PNG or JPG) | Displayed at the top of your Play Store listing. Can be a clean banner featuring the app name, dark aesthetic, and a tagline (*"Personal & Business Wallet Tracking"*). |
| **Phone Screenshots** | Min 2 screenshots (`1080 x 1920 px` recommended) | Capture at least: <br>1. **Dashboard Screen** (Net Balance card & Recent Transactions with sub-account badges) <br>2. **Transactions Screen** (Filtered transaction list) <br>3. **Accounts Screen** (Cash and custom sub-accounts) |
| **Adaptive Icon** | `1024 x 1024 px` foreground (PNG) | Specified in `app.json` under `android.adaptiveIcon`. |

---

## 3. Building the Android App Bundle (.aab)

Google Play requires **Android App Bundles (`.aab`)** rather than standard APKs for all store submissions.

## 3. Building on Windows PowerShell

Because EAS CLI's `--local` flag requires macOS, Linux, or Windows WSL2, building locally on native **Windows PowerShell** is done using **Native Android Gradle (`gradlew.bat`)**!

### Method A: Local Windows Build using Native Gradle (`gradlew.bat`) - Recommended for Local
1. **Generate the native Android project folder**:
   ```powershell
   npx expo prebuild --platform android
   ```
2. **Build a standalone APK (`.apk`) to install on your phone**:
   ```powershell
   cd android
   .\gradlew.bat assembleRelease
   ```
   - *Note on build time*: The very first run may take ~10–15 minutes if Gradle needs to download the Android NDK (~1.5 GB). Subsequent builds take only 1–2 minutes! Do not use `--verbose` as it is not a valid Gradle flag (use `--info` if you want verbose logs).
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

*(Note on Keystore & Signing: We have automatically generated a production 2048-bit RSA release keystore (`android/app/release.keystore`) and configured `android/app/build.gradle` to use it for all release builds. Your `.aab` bundles and `.apk` files are now signed in Release Mode and ready for Google Play Console!)*

---

### Method B: EAS Cloud Build (No Local Android Studio/JDK Required)
If your laptop does not have Android Studio or Java JDK installed, you can let EAS build in the cloud (no `--local` flag). It takes ~10–15 minutes while you continue other work:
```powershell
# For an installable APK file:
npx -y eas-cli build --platform android --profile preview

# For a Google Play Console AAB bundle:
npx -y eas-cli build --platform android --profile production
```

---

## 4. Setting Up Google Play Console

1. **Developer Registration**: Ensure you have an active [Google Play Developer Account](https://play.google.com/console) ($25 one-time registration fee).
2. **Create New App**:
   - Click **Create app**.
   - **App name**: `OrgWallet` (or your chosen brand name).
   - **Default language**: `English (United States) – en-US`.
   - **App or game**: **App**.
   - **Free or paid**: **Free**.
   - Accept the Developer Program Policies and click **Create app**.

---

## 5. Completing App Content & Data Safety

Before Google allows you to release an app, you must complete the items under **Policy -> App content** in the left sidebar:

### 1. Privacy Policy
- Provide a valid URL to a privacy policy document (required because OrgWallet uses network access and authentication).
- *Tip for MVP*: You can host a free markdown privacy policy page using GitHub Pages or TermsFeed.

### 2. App Access (Reviewer Credentials)
- Since OrgWallet requires authentication, select **"All or some functionality is restricted"**.
- Click **Add new instructions**:
  - Create a dedicated test user account in your production Supabase database (e.g., `reviewer@orgwallet.app` / `TestPassword123!`).
  - Provide these credentials so Google's review team can log in and test the personal wallet flow.

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

## 6. Publishing to an Initial Testing Track

To get the app on your phone and share it with testers immediately without waiting for a lengthy public store review, use **Internal Testing** or **Closed Testing (Beta)**.

### Step 6.1: Create Internal Test Release
1. In Google Play Console, go to **Testing -> Internal testing**.
2. Click **Create new release**.
3. Under **App bundles**, drag and drop your downloaded `.aab` file.
4. Under **Release name**, enter: `0.1.0-beta.1`.
5. Under **Release notes**, paste the summary from `CHANGELOG.md`:
   ```text
   Initial Beta Release (v0.1.0):
   - Personal Wallet mode with automatic 'Cash' sub-account creation.
   - Local-first SQLite database for instant offline interactivity.
   - Auto-syncing offline queue for accounts and transactions.
   - Accurate Net Balance calculation engine across all sub-accounts.
   - Universal bottom-right Floating Action Button for Expense, Income, and Transfers.
   - Sub-account badge attribution on all transaction lists.
   ```
6. Click **Next**, review any warnings, and click **Save and publish**.

### Step 6.2: Add Testers
- Under the **Testers** tab in **Internal testing**, create an email list containing your Google account email address.
- Copy the **opt-in URL** provided by Google Play Console, open it on your Android device, accept the testing invite, and download OrgWallet directly from the Google Play Store!

---

## 7. Pre-Flight Verification Checklist

Before clicking **Start rollout**, verify all items below:

- [ ] **Environment Variables**: Verify that your `.env.production` or EAS Environment Variables contain production-ready Supabase keys (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
- [ ] **OAuth Redirect URLs**: If using Google OAuth, verify that `orgwallet://auth/callback` and your Expo bundle identifiers are listed in your Google Cloud Console and Supabase Auth URL settings.
- [ ] **Database RLS Policies**: Ensure your Supabase PostgreSQL tables (`organizations`, `wallet_accounts`, `transactions`, `organization_members`) have Row Level Security (RLS) enabled in production.
- [ ] **Offline SQLite Verification**: Test turning off Wi-Fi/Cellular on a physical device—verify that adding an expense transaction works offline and syncs automatically when reconnected.
- [ ] **Reviewer Test Account**: Confirm that the demo account credentials provided in Play Console can successfully log in and access the Personal Wallet.
