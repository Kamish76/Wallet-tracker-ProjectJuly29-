# Graph Report - Wallet-tracker-ProjectJuly29-  (2026-11-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 466 nodes · 1129 edges · 18 communities (15 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `170a8131`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AddTransactionModal.tsx
- package.json
- OrgWalletWidgetEntryView
- expo
- WalletAuthService
- widgetService.ts
- OfflineDatabase
- dependencies
- OrgWallet
- SyncEngine
- OrgWallet iOS Beta Release Plan
- withIosWidget.js
- test-unit.mjs
- compilerOptions
- OrgWallet Brand Identity (Dark Slate Wallet, Orange Sync Arrows & Analytics Bar Chart)
- Context & Architecture Routing (Graphify + Obsidian + ICM)
- package-ipa.sh

## God Nodes (most connected - your core abstractions)
1. `OfflineDatabase` - 33 edges
2. `useTheme()` - 29 edges
3. `AddTransactionModal()` - 27 edges
4. `WalletAuthService` - 25 edges
5. `react` - 23 edges
6. `react-native` - 22 edges
7. `SyncEngine` - 21 edges
8. `OrgWalletWidgetEntryView` - 20 edges
9. `SettingsScreen()` - 20 edges
10. `DashboardScreen()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `widgetTaskHandler()` --references--> `react`  [EXTRACTED]
  src/widgets/widgetTaskHandler.ts → package.json
- `OrgWallet Android Adaptive Icon` --semantically_similar_to--> `OrgWallet Primary App Icon`  [INFERRED] [semantically similar]
  assets/adaptive-icon.png → assets/icon.png
- `OrgWallet Web Favicon` --semantically_similar_to--> `OrgWallet Primary App Icon`  [INFERRED] [semantically similar]
  assets/favicon.png → assets/icon.png
- `OrgWallet Brand Logo` --semantically_similar_to--> `OrgWallet Primary App Icon`  [INFERRED] [semantically similar]
  assets/logo.jpg → assets/icon.png
- `Release Notes & Google Play Console Guide (v0.4.4)` --semantically_similar_to--> `Release v0.4.4 (Performance & UI Refinement)`  [INFERRED] [semantically similar]
  RELEASE.md → CHANGELOG.md

## Import Cycles
- 2-file cycle: `src/lib/auth/walletAuth.ts -> src/lib/sync/syncEngine.ts -> src/lib/auth/walletAuth.ts`

## Hyperedges (group relationships)
- **iOS Beta Installation Paths** — ios_beta_release_plan_path_a_eas_adhoc, ios_beta_release_plan_path_b_apple_testflight, ios_beta_release_plan_path_c_local_sideloading [EXTRACTED 1.00]
- **Free Apple ID Testing Phases** — ios_beta_release_plan_expo_go_live_testing, ios_beta_release_plan_local_usb_installation, ios_beta_release_plan_sidestore [EXTRACTED 1.00]
- **Pre-Flight Build Configuration Pipeline** — ios_beta_release_plan_app_json_config, ios_beta_release_plan_eas_json_config, ios_beta_release_plan_platform_guarding [EXTRACTED 1.00]
- **Offline-First Personal Wallet Architecture** — readme_offline_sqlite_engine, readme_sync_engine, changelog_sqlite_mutex_withlock, changelog_net_balance_engine, readme_rule_2_personal_wallet_resolution [EXTRACTED 1.00]
- **Triad Context & Architecture Routing Workflow** — gemini_context_architecture_routing, gemini_graph_report, gemini_obsidian_devbrain, gemini_icm_staged_execution [EXTRACTED 1.00]
- **Cross-Platform Mobile Release & Distribution Pipeline (Android & iOS)** — release_google_play_guide, ios_beta_release_plan_doc, changelog_v0_4_4, readme_orgwallet [INFERRED 0.95]

## Communities (18 total, 3 thin omitted)

### Community 0 - "AddTransactionModal.tsx"
Cohesion: 0.07
Nodes (66): RFC-4122, RFC-5322, expo-linking, expo-router, expo-sqlite, lucide-react-native, react-native, @react-native-async-storage/async-storage (+58 more)

### Community 1 - "package.json"
Cohesion: 0.05
Nodes (45): devDependencies, @babel/core, babel-preset-expo, @expo/ngrok, @types/react, typescript, main, name (+37 more)

### Community 2 - "OrgWalletWidgetEntryView"
Cohesion: 0.07
Nodes (25): OrgWalletEntry, OrgWalletProvider, OrgWalletWidget, .body, OrgWalletWidgetEntryView, .activeContent, .balanceTextColor, .baseSurfaceColor (+17 more)

### Community 3 - "expo"
Cohesion: 0.05
Nodes (38): backgroundColor, foregroundImage, monochromeImage, adaptiveIcon, icon, package, permissions, versionCode (+30 more)

### Community 4 - "WalletAuthService"
Cohesion: 0.10
Nodes (10): createStyles(), LoginScreen(), createStyles(), SettingsScreen(), createStyles(), ManageCategoriesModal(), isWalletOrganization(), WalletAuthService (+2 more)

### Community 5 - "widgetService.ts"
Cohesion: 0.10
Nodes (11): IOS_APP_GROUP, OrgWalletIosWidget, OrgWalletIosWidgetNativeModule, react, react, react-native-android-widget, WidgetService, getAndroidHexColor() (+3 more)

### Community 6 - "OfflineDatabase"
Cohesion: 0.21
Nodes (5): createStyles(), DashboardScreen(), AddTransactionModal(), createStyles(), OfflineDatabase

### Community 7 - "dependencies"
Cohesion: 0.07
Nodes (27): dependencies, expo, expo-background-task, expo-constants, expo-linking, expo-router, expo-secure-store, expo-sqlite (+19 more)

### Community 8 - "OrgWallet"
Cohesion: 0.12
Nodes (16): Google OAuth Sign-In Transient Error Popup, Known Bugs Log (v0.4.1), Total Net Balance Pagination Calculation Discrepancy, Accurate Net Balance Engine, OrgWallet, Release v0.1.0 (Initial Beta Release), Release v0.2.0 (Live Android Home Screen Widget & Branding), Release v0.3.0 (Offline Transaction & Sub-Account Management) (+8 more)

### Community 9 - "SyncEngine"
Cohesion: 0.16
Nodes (8): react-native-safe-area-context, @react-navigation/material-top-tabs, styles, TabsLayout(), MaterialTopTabs, { Navigator }, SyncEngine, SyncSettings

### Community 10 - "OrgWallet iOS Beta Release Plan"
Cohesion: 0.22
Nodes (14): App.json iOS Configuration, iOS Developer Mode Setup, OrgWallet iOS Beta Release Plan, EAS Cloud Build Service, Eas.json Build Profiles, Expo Go Live Beta Testing, iPhone XR Hardware & UI Verification Checklist, Local Native Installation via USB (+6 more)

### Community 11 - "withIosWidget.js"
Cohesion: 0.15
Nodes (6): config, { getDefaultConfig }, fs, path, {
  withEntitlementsPlist,
  withXcodeProject,
  withDangerousMod,
}, expo

### Community 12 - "test-unit.mjs"
Cohesion: 0.25
Nodes (7): id, localSample, shiftedDate, shiftedIso, formatLocalDateInput(), mergeDateWithOriginalTime(), evaluateMathExpression()

### Community 13 - "compilerOptions"
Cohesion: 0.22
Nodes (8): expo/tsconfig.base, compilerOptions, baseUrl, jsx, paths, strict, extends, include

### Community 14 - "OrgWallet Brand Identity (Dark Slate Wallet, Orange Sync Arrows & Analytics Bar Chart)"
Cohesion: 0.43
Nodes (7): OrgWallet Android Adaptive Icon, OrgWallet Web Favicon, OrgWallet Brand Color Palette (Dark Slate & Vibrant Orange), OrgWallet Primary App Icon, Wallet Sync & Financial Analytics Visual Motif, OrgWallet Brand Identity (Dark Slate Wallet, Orange Sync Arrows & Analytics Bar Chart), OrgWallet Brand Logo

## Knowledge Gaps
- **42 isolated node(s):** `RFC-4122`, `RFC-5322`, `@babel/core`, `babel-preset-expo`, `expo-constants` (+37 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 185 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `package.json`, `widgetService.ts`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **What connects `RFC-4122`, `RFC-5322`, `@babel/core` to the rest of the system?**
  _42 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AddTransactionModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06828282828282828 - nodes in this community are weakly interconnected._
- **Why does `react-native` connect `AddTransactionModal.tsx` to `package.json`, `widgetService.ts`, `SyncEngine`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._
- **Why does `react` connect `widgetService.ts` to `AddTransactionModal.tsx`, `package.json`, `SyncEngine`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Should `OrgWalletWidgetEntryView` be split into smaller, more focused modules?**
  _Cohesion score 0.06859903381642513 - nodes in this community are weakly interconnected._