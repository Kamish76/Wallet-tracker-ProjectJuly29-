# Graph Report - Wallet-tracker-ProjectJuly29-  (2026-10-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 444 nodes · 1073 edges · 19 communities (13 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8071455a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AddTransactionModal.tsx
- OfflineDatabase
- package.json
- expo
- OrgWalletEntry
- dependencies
- WalletAuthService
- widgetService.ts
- OrgWallet
- withIosWidget.js
- re
- OrgWallet iOS Beta Release Plan
- compilerOptions
- OrgWallet Brand Identity (Dark Slate Wallet, Orange Sync Arrows & Analytics Bar Chart)
- Context & Architecture Routing (Graphify + Obsidian + ICM)
- supabase.ts
- package-ipa.sh

## God Nodes (most connected - your core abstractions)
1. `OfflineDatabase` - 34 edges
2. `SyncEngine` - 22 edges
3. `EditTransactionModal()` - 22 edges
4. `react` - 22 edges
5. `react-native` - 22 edges
6. `WalletAuthService` - 21 edges
7. `AddTransactionModal()` - 21 edges
8. `Colors` - 18 edges
9. `WidgetService` - 17 edges
10. `WalletAccount` - 15 edges

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
- None detected.

## Hyperedges (group relationships)
- **iOS Beta Installation Paths** — ios_beta_release_plan_path_a_eas_adhoc, ios_beta_release_plan_path_b_apple_testflight, ios_beta_release_plan_path_c_local_sideloading [EXTRACTED 1.00]
- **Free Apple ID Testing Phases** — ios_beta_release_plan_expo_go_live_testing, ios_beta_release_plan_local_usb_installation, ios_beta_release_plan_sidestore [EXTRACTED 1.00]
- **Pre-Flight Build Configuration Pipeline** — ios_beta_release_plan_app_json_config, ios_beta_release_plan_eas_json_config, ios_beta_release_plan_platform_guarding [EXTRACTED 1.00]
- **Offline-First Personal Wallet Architecture** — readme_offline_sqlite_engine, readme_sync_engine, changelog_sqlite_mutex_withlock, changelog_net_balance_engine, readme_rule_2_personal_wallet_resolution [EXTRACTED 1.00]
- **Triad Context & Architecture Routing Workflow** — gemini_context_architecture_routing, gemini_graph_report, gemini_obsidian_devbrain, gemini_icm_staged_execution [EXTRACTED 1.00]
- **Cross-Platform Mobile Release & Distribution Pipeline (Android & iOS)** — release_google_play_guide, ios_beta_release_plan_doc, changelog_v0_4_4, readme_orgwallet [INFERRED 0.95]

## Communities (19 total, 6 thin omitted)

### Community 0 - "AddTransactionModal.tsx"
Cohesion: 0.07
Nodes (61): RFC-4122, RFC-5322, expo-linking, expo-router, lucide-react-native, react, react-native, @react-native-async-storage/async-storage (+53 more)

### Community 1 - "OfflineDatabase"
Cohesion: 0.12
Nodes (16): RootLayout(), AccountsScreen(), DashboardScreen(), TabsLayout(), SettingsScreen(), load(), TransactionsScreen(), AddTransactionModal() (+8 more)

### Community 2 - "package.json"
Cohesion: 0.04
Nodes (44): devDependencies, @babel/core, babel-preset-expo, @expo/ngrok, @types/react, typescript, main, name (+36 more)

### Community 3 - "expo"
Cohesion: 0.05
Nodes (38): backgroundColor, foregroundImage, monochromeImage, adaptiveIcon, icon, package, permissions, versionCode (+30 more)

### Community 4 - "OrgWalletEntry"
Cohesion: 0.11
Nodes (12): OrgWalletEntry, OrgWalletProvider, OrgWalletWidget, .body, OrgWalletWidgetEntryView, .body, .content, QuickActionButton (+4 more)

### Community 5 - "dependencies"
Cohesion: 0.07
Nodes (28): dependencies, expo, expo-background-task, expo-constants, expo-linking, expo-router, expo-secure-store, expo-sqlite (+20 more)

### Community 6 - "WalletAuthService"
Cohesion: 0.14
Nodes (11): AuthCallbackScreen(), handleAuthCallback(), LoginScreen(), IndexScreen(), checkAuthAndRoute(), init(), init(), init() (+3 more)

### Community 7 - "widgetService.ts"
Cohesion: 0.14
Nodes (9): IOS_APP_GROUP, OrgWalletIosWidget, OrgWalletIosWidgetNativeModule, react-native-android-widget, WidgetService, getAndroidHexColor(), OrgWalletWidget(), OrgWalletWidgetProps (+1 more)

### Community 8 - "OrgWallet"
Cohesion: 0.12
Nodes (16): Google OAuth Sign-In Transient Error Popup, Known Bugs Log (v0.4.1), Total Net Balance Pagination Calculation Discrepancy, Accurate Net Balance Engine, OrgWallet, Release v0.1.0 (Initial Beta Release), Release v0.2.0 (Live Android Home Screen Widget & Branding), Release v0.3.0 (Offline Transaction & Sub-Account Management) (+8 more)

### Community 9 - "withIosWidget.js"
Cohesion: 0.12
Nodes (8): config, { getDefaultConfig }, fs, path, {
  withEntitlementsPlist,
  withXcodeProject,
  withDangerousMod,
}, expo, code, fs

### Community 11 - "OrgWallet iOS Beta Release Plan"
Cohesion: 0.22
Nodes (14): App.json iOS Configuration, iOS Developer Mode Setup, OrgWallet iOS Beta Release Plan, EAS Cloud Build Service, Eas.json Build Profiles, Expo Go Live Beta Testing, iPhone XR Hardware & UI Verification Checklist, Local Native Installation via USB (+6 more)

### Community 12 - "compilerOptions"
Cohesion: 0.22
Nodes (8): expo/tsconfig.base, compilerOptions, baseUrl, jsx, paths, strict, extends, include

### Community 13 - "OrgWallet Brand Identity (Dark Slate Wallet, Orange Sync Arrows & Analytics Bar Chart)"
Cohesion: 0.43
Nodes (7): OrgWallet Android Adaptive Icon, OrgWallet Web Favicon, OrgWallet Brand Color Palette (Dark Slate & Vibrant Orange), OrgWallet Primary App Icon, Wallet Sync & Financial Analytics Visual Motif, OrgWallet Brand Identity (Dark Slate Wallet, Orange Sync Arrows & Analytics Bar Chart), OrgWallet Brand Logo

## Knowledge Gaps
- **31 isolated node(s):** `RFC-4122`, `RFC-5322`, `expo/tsconfig.base`, `@babel/core`, `babel-preset-expo` (+26 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 178 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **What connects `RFC-4122`, `RFC-5322`, `expo/tsconfig.base` to the rest of the system?**
  _31 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AddTransactionModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07111298127498422 - nodes in this community are weakly interconnected._
- **Why does `react-native` connect `AddTransactionModal.tsx` to `package.json`, `widgetService.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `OfflineDatabase` be split into smaller, more focused modules?**
  _Cohesion score 0.12401693889897157 - nodes in this community are weakly interconnected._
- **Why does `react` connect `AddTransactionModal.tsx` to `package.json`, `widgetService.ts`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.04421768707482993 - nodes in this community are weakly interconnected._