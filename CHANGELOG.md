# Changelog - OrgWallet

All notable changes to the OrgWallet project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0] - Offline Transaction & Sub-Account Management Release (2026-08-03)

### 🌟 New Features & Capabilities

- **Full Offline-First Transaction Editing & Deletion**:
  - Engineered a comprehensive **Transaction Editor Modal** (`src/components/EditTransactionModal.tsx`, 631 lines) supporting instant editing of transaction amounts, titles, preset/custom categories, assigned sub-accounts, date/times, notes, and income/expense/transfer types.
  - Implemented local SQLite persistence (`updateTransaction`, `deleteTransaction` in `OfflineDatabase`) with automatic net balance and sub-account balance recalculation.
  - Integrated bidirectional offline synchronization queue actions (**`UPDATE_TRANSACTION`**, **`DELETE_TRANSACTION`**) in `SyncEngine.processQueueItem()`, ensuring changes made offline automatically synchronize with Supabase upon reconnection.
  - Upgraded both the **Dashboard** (`/dashboard`) and **Transactions** screen (`/transactions`) with quick-action cards, category badges, account names, and 1-tap edit/delete modal triggers.

- **Full Offline-First Sub-Account Editing & Deletion**:
  - Engineered an interactive sub-account management editor on the **Accounts** screen (`/accounts`), allowing users to update account names, account types (`Cash`, `Bank`, `Credit Card`, `Digital Wallet`, `Investment`), starting balances, currencies, and descriptions.
  - **Dynamic Balance Recalculation**: Changing an account's starting balance or modifying transactions automatically recomputes current balances locally and triggers background widget refresh.
  - **Rule #2 Enforcement (Account Deletion Safeguard)**: Before any account deletion attempt, OrgWallet queries `getAccountTransactionsCount(id)` in local SQLite. If an account is referenced by existing transactions, hard deletion is blocked and the user is guided to safely archive (`is_active = false`) the account instead, protecting historical ledger integrity.
  - Added offline synchronization queue actions (**`UPDATE_ACCOUNT`**, **`DELETE_ACCOUNT`**) with automatic retry and conflict resolution policies.

- **Settings Screen Release Version Tracking**:
  - Updated the About section in **Settings** (`/settings`) to dynamically display **`OrgWallet v0.3.0`**, keeping users informed of their installed release build.

### 🔧 Technical Improvements & Fixes

- **SQLite FIFO Mutex Serialization (`withLock`)**:
  - Wrapped all new transaction and sub-account CRUD and count operations (`getAccountTransactionsCount`, `updateTransaction`, `deleteTransaction`, `updateAccount`, `deleteAccount`) in asynchronous FIFO mutex locks (`withLock`), preventing native Android SQLite statement collisions.
- **Android System Java 25 / OpenJDK 21 Alignment**:
  - Verified and maintained Gradle compatibility for command-line (`gradlew.bat`) and IDE builds using Android Studio's bundled OpenJDK 21 (`W:/Dev/Android/Android Studio/jbr`).

---

## [0.2.0] - Live Android Home Screen Widget & Branding Release (2026-07-31)

### 🌟 New Features & Capabilities

- **Live Android Home Screen Widget (`OrgWalletBalance`)**:
  - Engineered a native Android home screen widget displaying the user's **Total Net Balance** in real time directly on the phone launcher screen.
  - Implemented automatic background balance synchronization (`widgetTaskHandler.ts` & `widgetService.ts`), ensuring the widget balance updates immediately when local SQLite accounts or transactions mutate.
  - Built responsive AnyDPI native XML layouts (`widget_initial_layout.xml`, `widgetprovider_orgwalletbalance.xml`) compatible with all Android launcher sizes and screen densities.

- **1-Tap Quick Action Shortcuts on Widget**:
  - Integrated dedicated quick-action shortcut buttons directly on the home screen widget card: **`+ Expense`**, **`+ Income`**, and **`+ Transfer`**.
  - Tapping a shortcut launches OrgWallet directly into a standalone modal route (`/action/add-transaction`) with the target transaction type pre-selected, reducing transaction logging to a single tap.

- **Wallpaper Translucency & Custom Opacity Control**:
  - Added an interactive **Widget Background Opacity Slider** in the new **Settings** screen (`/settings`), allowing users to adjust translucency between 20% and 100% opacity (`0.2` to `1.0`).
  - Implemented an interactive on-screen **Live Widget Preview Card** inside Settings that renders the exact balance and styling as adjusted.

- **Advanced Offline Sync Management UI (`/settings`)**:
  - Added a dedicated **Settings & Synchronization Management** screen.
  - **Configurable Sync Modes**: Enable automatic real-time background sync, manual-only mode, or scheduled syncs (every 15 minutes, 60 minutes, or Daily / 24 hours).
  - **Conflict Resolution Policies**: User-selectable policy for offline mutations (`local_wins`, `server_wins`, or `ask_user`).
  - **Queue Badge Counter & Manual Sync Trigger**: Live counter of unsynchronized offline items with a **Sync Now** action button providing immediate feedback alerts upon completion.

- **Full Production Branding & Visual Identity**:
  - Replaced Expo default placeholders with custom high-resolution **App Icon** (`assets/icon.png`), **Adaptive Launcher Icon** (`assets/adaptive-icon.png`), and **Favicon**.
  - Added branded app logos (`assets/logo.jpg`) and integrated custom splash screen drawable logos across all Android screen densities (`hdpi`, `mdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`).
  - Integrated brand logo headers into Login and OAuth Callback screens.

---

### 🔧 Technical Improvements & Fixes

- **Java 25 (Major Version 69) Compatibility Resolution**:
  - Resolved Gradle 8.14.3 build failures on machines with system Java 25 (`W:\Dev\JDK`) by configuring `org.gradle.java.home=W:/Dev/Android/Android Studio/jbr` in `android/gradle.properties`, directing Gradle to Android Studio's OpenJDK 21.
- **Production Keystore Release Signing**:
  - Generated an automated production 2048-bit RSA release keystore (`android/app/release.keystore`) and configured `android/app/build.gradle` to use a dedicated `signingConfigs.release` block, ensuring all APK and AAB builds are signed in Release Mode and compliant with Google Play Console requirements.
- **Android Adaptive Launcher Icons**:
  - Added AnyDPI adaptive launcher XML configurations (`ic_launcher.xml`, `ic_launcher_round.xml`) for modern Android devices.

---

### 🔄 Updated Primary User Flows

1. **1-Tap Home Screen Transaction Logging Flow**:
   - User glances at their real-time Net Balance on the Android Home Screen Widget.
   - User taps **`+ Expense`**, **`+ Income`**, or **`+ Transfer`** directly on the widget.
   - OrgWallet opens immediately to `/action/add-transaction` with the transaction type pre-selected.
   - User inputs amount and saves; local SQLite database, UI lists, and home screen widget update instantly.

2. **Widget Opacity Customization Flow**:
   - Navigate to **Settings** tab $\rightarrow$ **Widget Configuration**.
   - Drag the background opacity slider while observing the **Live Preview Card**.
   - Tap **Apply & Update Widget** to instantly push the visual update to the native Android widget.

3. **Offline Sync Queue & Manual Trigger Flow**:
   - In environments with limited connectivity, users can inspect their pending mutation count in **Settings**.
   - When connection is restored, user taps **Sync Now** to immediately flush the offline SQLite queue to Supabase and receive status verification.

---

## [0.1.0] - Initial Beta Release (2026-07-30)

### 🌟 Core Features & Capabilities

- **Personal Wallet Mode**:
  - Automatic detection and creation of dedicated Personal Wallet organizations using the `[wallet]` metadata marker.
  - Automatic spawning of a default **`Cash`** sub-account (`starting_value: $0.00`, `is_active: true`) upon initial wallet creation.
  - Clean separation of personal finance workflows from multi-user business organization features.

- **Local-First Architecture & SQLite Storage**:
  - Offline-first data persistence using Expo SQLite (`orgwallet.db`).
  - Accounts and Transactions are saved locally immediately, providing instant UI reactivity and zero-latency interactions even without internet access.

- **Offline Sync Engine**:
  - Robust mutation queueing (`offline_sync_queue`) for creating transactions and accounts while offline.
  - Automatic background synchronization when network connection is restored.
  - Support for configurable conflict resolution policies (`local_wins`, `server_wins`, `ask_user`).

- **Accurate Net Balance Engine**:
  - Dynamic financial balance calculation summing:
    $$\text{Total Net Balance} = \sum (\text{Account Starting Values}) + \text{Total Income} - \text{Total Expenses} - \text{Transfers (net zero across sub-accounts)}$$
  - Real-time per-account balance tracking accounting for initial values, income, expenses, and inter-account transfers.

- **Multi-Sub-Account Management**:
  - Create and manage multiple wallet sub-accounts (e.g., Cash, Checking, Savings, Credit Cards).
  - Archive obsolete accounts (`is_active = false`) without hard-deleting historical transactions, preserving audit trails.

- **Universal Transaction FAB & Shared Modal**:
  - Prominent bottom-right **Floating Action Button (FAB)** available across both the **Dashboard** and **Transactions** screens.
  - Unified **`AddTransactionModal`** supporting three core transaction types:
    1. **Expense**: Personal/business expenditures categorized by sub-account.
    2. **Income**: Earnings and deposits credited to a sub-account.
    3. **Transfer**: Direct account-to-account funds transfers with automatic debit and credit balancing.

- **Account Badge Attribution**:
  - Clear visual sub-account badges displayed on every transaction item in the Dashboard and Transactions lists:
    - *Expense / Income*: Displayed as `Cash • 7/30/2026`
    - *Transfer*: Displayed as `Cash → Savings • 7/30/2026`
  - Inline indicator for `(Offline Pending)` transactions waiting for server sync.

- **Instant Tab Navigation & In-Memory Caching**:
  - Implemented in-memory caching (`WalletAuthService.cachedOrgId`) and non-blocking background sync, eliminating UI freezes when switching between Dashboard, Transactions, and Accounts tabs.

---

### 🔄 Primary User Flows

1. **Onboarding & Authentication Flow**:
   - User signs in via **Email/Password** or **Google OAuth**.
   - System queries existing organizations or automatically provisions a new Personal Wallet organization and default `Cash` sub-account.
   - Initial cloud data is synced silently in the background while local SQLite data displays instantly.

2. **Sub-Account Management Flow**:
   - Navigate to the **Accounts** tab $\rightarrow$ Tap **`+ New Sub-Account`**.
   - Enter customized account name and optional starting balance.
   - Account is immediately stored in SQLite and queued for Supabase synchronization.

3. **Transaction Creation & Sync Flow**:
   - Tap the **`+ Add Transaction`** button from either Dashboard or Transactions.
   - Select transaction type, target sub-account(s), amount, category, and notes.
   - Upon saving, local balances and lists refresh immediately; `SyncEngine` pushes the mutation to the cloud in the background.

---

### 🏗️ Technical & Architectural Notes

- **Supabase Authorization Guard**:
  - Replaced manual `.single()` queries against `organization_members` with server-side `requireOrgMembership(id)` to prevent PostgreSQL `PGRST116` errors for organization owners.
- **PostgreSQL UUID & Syntax Protection**:
  - Implemented automatic sanitization in `SyncEngine` to validate or regenerate UUIDs, preventing PostgreSQL `22P02` (invalid input syntax for uuid) errors when replaying legacy offline queue items.
- **RLS Recursion Safeguard**:
  - Resolved `42P17` infinite recursion policies on `organization_members` by inspecting accessible `organizations` directly during wallet resolution.

---

### 💡 Intuition Notes & Roadmap for Future Releases

As an initial release to get things going, the core functional loop is rock-solid. Here are key areas recommended for upcoming releases:

- **Branding & Visual Assets**:
  - Replace default Expo placeholder icons with a dedicated production **App Icon**, **Adaptive Icon**, and branded **Splash Screen**.
- **Visual Analytics & Charts**:
  - Introduce graphical charts (e.g., Category Spending Pie Chart, Monthly Income vs. Expense Bar Chart, and Net Worth Trend Line) on the Dashboard.
- **Data Export & Reporting**:
  - Add CSV and PDF export functionality for tax preparation and personal archiving.
- **Recurring Transactions & Push Reminders**:
  - Enable automated recurring transactions for monthly bills and subscriptions, paired with local push notification reminders.
- **Interactive Conflict Resolution UI**:
  - Build a visual comparison modal for users when the `ask_user` sync conflict resolution policy triggers.
