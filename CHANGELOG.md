# Changelog - OrgWallet

All notable changes to the OrgWallet project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
