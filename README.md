# OrgWallet

<p align="center">
  <strong>The Official Android Mobile Companion for OrgFinance Personal Wallet Mode</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android_First-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android First" />
  <img src="https://img.shields.io/badge/Framework-React_Native_%2B_Expo-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/Database-SQLite_%2B_Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Status-v0.3.0_Live-00F2FE?style=for-the-badge" alt="Version 0.3.0" />
</p>

---

## Overview

**OrgWallet** is an Android-focused mobile application designed to provide seamless, unified access to your **OrgFinance Personal Wallet Mode** (`is_wallet = true`). Whether you are online or completely disconnected, OrgWallet empowers you to track personal income, expenses, and sub-account balances with instant local responsiveness and enterprise-grade synchronization.

Built on top of **React Native (Expo Router + TypeScript)**, OrgWallet brings the signature rich, vibrant dark-mode aesthetics of the OrgFinance web application to your mobile device, while adding first-class **offline transaction queues** and **user-controlled periodic synchronization**.

---

## ✨ Key Features

### 1. Unified Supabase Access
- **Single Identity**: Sign in using your existing **Email/Password** or **Google OAuth** account from OrgFinance.
- **Rule #1 Enforcement (Organization Membership Guards)**: Security access queries strictly verify organization ownership (`owner_id = userId`) and active membership (`organization_members.user_id = userId AND is_active = true`) without brittle single-row assumptions.

### 2. Smart Personal Wallet Resolution (Rule #2)
- **Automatic Wallet Detection**: On login, OrgWallet automatically resolves your active Personal Wallet organization (`is_wallet = true` or `[wallet]` marker).
- **Default Sub-Account Spawning**: When creating a new Personal Wallet, OrgWallet automatically spawns a default `'Cash'` sub-account (`starting_value: 0`, `is_active: true`) ready for immediate use.
- **Dedicated Wallet UI**: Cleanly hides multi-user business features (such as member balances and business quick actions) to focus 100% on personal wallet tracking.

### 3. Offline-First SQLite Engine
- **Instant Offline CRUD**: Powered by local SQLite (`expo-sqlite`), all accounts and recent transactions are mirrored locally (`local_accounts`, `local_transactions`).
- **Offline Quick Add**: Log income, personal expenses, or inter-account transfers anytime, anywhere—even without Wi-Fi or cellular service.

### 4. User-Controlled Sync Strategy
Take full command of your background and network data in **Wallet Settings -> Offline & Sync Settings**:
- **Sync Mode**: Choose between `Automatic (Any Network)`, `Wi-Fi Only`, or `Manual Only`.
- **Periodic Sync Interval**: Set background sync frequency (`15 minutes`, `1 hour`, or `6 hours`).
- **Conflict Resolution Priority**: Specify whether `Local wins` (overwrite server changes) or `Server wins` (discard local changes on conflict).
- **Real-Time Queue Inspector**: View pending mutations and trigger a manual **"Sync Now"** anytime.

### 5. Account Deletion Safeguard
- **Historical Integrity**: To prevent accidental data loss or orphaned transaction references, OrgWallet forbids hard-deleting sub-accounts. Users can safely **Archive** (`is_active = false`) accounts instead.

---

## 🏛️ Project Architecture

```
w:\projects\OrgWallet\
├── app.json                     # Android & Expo application configuration
├── package.json                 # Dependencies and build scripts
├── tsconfig.json                # TypeScript configuration & path aliases
├── README.md                    # Project documentation
└── src/
    ├── app/                     # Expo Router file-based navigation
    │   ├── _layout.tsx          # Root provider layout & SQLite initialization
    │   ├── index.tsx            # Splash & session/wallet resolver
    │   ├── (auth)/login.tsx     # Email & Google OAuth sign-in screen
    │   └── (tabs)/              # Bottom tab navigation bar
    │       ├── _layout.tsx      # Tab bar with real-time sync badge
    │       ├── dashboard.tsx    # Hero balance card & quick stats
    │       ├── transactions.tsx # Filter pills & Offline Quick Add modal
    │       ├── accounts.tsx     # Sub-accounts list & Archive safeguard
    │       └── settings.tsx     # Profile & Offline/Sync Strategy controls
    ├── lib/
    │   ├── auth/
    │   │   └── walletAuth.ts    # Unified auth & Rule #1 / Rule #2 resolver
    │   ├── database/
    │   │   └── sqlite.ts        # Local SQLite schema & CRUD (expo-sqlite)
    │   ├── supabase/
    │   │   └── client.ts        # Supabase JS client with AsyncStorage
    │   └── sync/
    │       └── syncEngine.ts    # Push/pull sync queue & conflict engine
    ├── theme/
    │   ├── colors.ts            # OrgFinance dark vibrant color palette
    │   └── tokens.ts            # Typography, spacing, and card tokens
    └── types/
        ├── supabase.ts          # Supabase DB schema interfaces
        └── wallet.ts            # Core wallet & sync queue types
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **Android Studio / Android SDK**: For local Android emulator testing
- **Expo CLI**: Optional global install (`npm install -g expo-cli`)

### 2. Environment Setup
Create a `.env` or `.env.local` file in the root directory with your Supabase credentials:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Locally (Android)
```bash
# Start the Expo development server for Android
npm run android

# Or start the interactive Expo CLI
npm start
```

---

## 🛠️ Building for Production (Android APK / AAB)

OrgWallet is configured for standard Android builds via [Expo Application Services (EAS)](https://expo.dev/eas) or React Native CLI:

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure project
eas build:configure

# Build Android APK for direct device installation
eas build -p android --profile preview

# Build Android App Bundle (AAB) for Google Play Store
eas build -p android --profile production
```

---

## 📜 License & Compliance

OrgWallet is part of the **OrgFinance** ecosystem. All project conventions (Rule #1 Organization Membership Guards and Rule #2 Personal Wallet Mode Conventions) are strictly enforced across both web and mobile clients.
