# OrgWallet — Project-Scoped Rules

## Android Build — Java 25 Incompatibility Fix
This machine's system Java (`W:\Dev\JDK`) is **Java 25**, which outputs class file major version 69. Gradle 8.14.3 only supports up to Java 21 and will fail with `Unsupported class file major version 69`.

**Fix:** `android/gradle.properties` must always contain:
```
org.gradle.java.home=W:/Dev/Android/Android Studio/jbr
```
This points Gradle to Android Studio's bundled **OpenJDK 21** (`W:\Dev\Android\Android Studio\jbr`). If `npx expo prebuild --clean` regenerates `android/gradle.properties`, re-add this line before running `gradlew.bat`.

## SQLite Concurrency & Stability (`expo-sqlite` Android Rules)

### 1. Dedicated Connection Handle (`useNewConnection: true`)
When opening SQLite database connections in `OfflineDatabase.getDb()`, always pass `{ useNewConnection: true }` in `SQLite.openDatabaseAsync(DB_NAME, { useNewConnection: true })` and manage the connection via a singleton `dbPromise`. Using the default shared connection pool causes Kotlin/JNI statement cache collisions on Android when async tasks overlap.

### 2. Mutex Serialization (`withLock`)
Always wrap all SQLite reads and writes (`upsertTransaction`, `getTransactions`, `upsertAccount`, `enqueueMutation`, `getAccounts`, etc.) in an asynchronous FIFO mutex queue (`withLock`). Concurrent async queries from UI renders, `SyncEngine.syncNow`, and `WidgetService.refreshWidgetData` racing on native statement preparation trigger `java.lang.NullPointerException` in `NativeDatabase.prepareAsync` on Android.

### 3. Strict Null Coalescing for Bind Parameters
Never pass `undefined` values into SQLite query parameter arrays. Always use strict null-coalescing (`?? null` for strings/dates and `?? 0` for numeric fallbacks) to prevent JNI argument marshalling crashes.

## Client-Side Security & Input Sanitization

### 1. Mandatory Input Sanitization
Before writing user-provided text strings (names, descriptions, categories) to local SQLite or sending to Supabase, always sanitize inputs using `SecurityService.sanitizeText(input, maxLength)` to strip ASCII control characters (`\x00-\x08\x0B\x0C\x0E-\x1F\x7F`) and HTML/script tags, preventing XSS and injection payloads.

### 2. Numeric Amount Validation
Always validate financial amounts and starting balances using `SecurityService.validateAmount(amount, { min, max })`. Reject `NaN`, `Infinity`, negative values where inappropriate, and enforce overflow caps (`$1,000,000,000` max). Always round to 2 decimal places to prevent floating-point drift.

### 3. Persisted Sliding-Window Rate Limiting
Enforce rate limits on sensitive user actions using `RateLimiter.assertAllowed(action, policy)` and record attempts with `RateLimiter.recordAttempt(action, policy)`:
- **`AUTH_LOGIN`** (`5 attempts / 60s`): Protects against credential brute-forcing.
- **`AUTH_OAUTH`** (`10 attempts / 60s`): Throttles OAuth session initiation.
- **`SYNC_NOW`** (`10 attempts / 60s`): Prevents UI spamming or background loops from flooding Supabase APIs.
- **`MUTATION_CREATE`** (`60 attempts / 60s`): Prevents automated scripts or UI spam from flooding the offline SQLite sync queue.
*Rate-limit history must be persisted in `AsyncStorage` (`@orgwallet_rate_limit_history`) so limits survive app restarts.*
- **UI Event Handler Exception Safety**: In React Native UI components (e.g., modals, form submit buttons), use `await RateLimiter.checkLimit(action, policy)` instead of `assertAllowed` so the component can inspect `{ allowed, retryAfterSeconds }` and display a clean `Alert.alert(...)` without throwing unhandled exceptions.

## Session Hygiene & First-Time Auto Sync

### 1. Login & Logout Data Scrubbing
Always call `OfflineDatabase.clearAllData()` and `WalletAuthService.clearCache()` upon logout or before authenticating a new user. Never leave cached SQLite accounts, transactions, or offline queue items from a previous session.

### 2. Post-Login First-Time Auto Sync
When resolving a user's wallet organization after authentication (`resolveUserWallet`), always `await SyncEngine.firstTimeAutoSync(orgId)` before navigating to `/dashboard`. This guarantees that local SQLite is fully populated with `wallet_accounts` and `transactions` and Android home screen widgets are refreshed before the dashboard mounts.

## Syncable Entity Extensibility & Category Rules

### 1. 4-Layer Checklist for New Syncable Entities
When adding a new syncable entity (e.g., `transaction_categories`) to OrgWallet, implement it across all four mandatory layers:
1. **Supabase Schema**: Define the table type in `types/supabase.ts`.
2. **Domain Types & Actions**: Define the TypeScript interface and add corresponding queue mutation action names (`CREATE_*`, `UPDATE_*`, `DELETE_*`) to `SyncQueueAction` in `types/wallet.ts`.
3. **Offline SQLite Storage**: Create the SQLite table in `initDb()`, wrap all CRUD methods in `withLock()`, and scrub the table in `clearAllData()` upon logout.
4. **Sync Engine Integration**: Implement pull/push logic in `SyncEngine` (`syncEngine.ts`) and register mutation handlers in `processQueueItem()`.

### 2. Personal Wallet Category Seeding & Sync Invariants
- **No Auto-Seeding on Sync Pulls**: Never seed default categories during mobile sync pulls. Category syncing must strictly download and mirror what is explicitly stored in `transaction_categories` on the database.
- **Historical Transaction Label Preservation**: Deleting a category removes the category definition from `transaction_categories` for new transactions but preserves text labels on historical transactions.
