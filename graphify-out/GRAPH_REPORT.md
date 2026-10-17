# Graph Report - Wallet-tracker-ProjectJuly29-  (2026-10-16)

## Corpus Check
- 69 files · ~144,037 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 2, .example 1, .code-workspace 1)

## Summary
- 445 nodes · 1085 edges · 22 communities (17 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.88)
- Token cost: 3,500 input · 1,200 output

## Community Hubs (Navigation)
- Core Offline SQLite & UI Styling
- Screens & Transaction Modals
- Expo App Configuration
- iOS SwiftUI WidgetKit Extension
- Wallet Auth & Session Resolver
- Expo Runtime Dependencies
- Package Manifest & Core Libs
- Release History & Architecture Docs
- Cross-Platform Widget Bridge & Handlers
- iOS Widget Config Plugin & Bundler
- Code Migration Patch Scripts
- iOS Beta & SideStore Release Plan
- Background Sync & Root Layout
- TypeScript Compiler Config
- Brand Identity & App Icons
- NPM Build & Run Scripts
- TypeScript & Babel Dev Tooling
- Material Top Tabs Navigation
- Triad Context & ICM Routing
- SideStore IPA Packager Script

## God Nodes (most connected - your core abstractions)
1. `OfflineDatabase` - 34 edges
2. `react` - 22 edges
3. `react-native` - 22 edges
4. `EditTransactionModal()` - 22 edges
5. `SyncEngine` - 22 edges
6. `AddTransactionModal()` - 21 edges
7. `WalletAuthService` - 21 edges
8. `Colors` - 18 edges
9. `WidgetService` - 17 edges
10. `expo` - 15 edges

## Surprising Connections (you probably didn't know these)
- `widgetTaskHandler()` --references--> `react`  [EXTRACTED]
  src/widgets/widgetTaskHandler.ts → package.json
- `Release Notes & Google Play Console Guide (v0.4.4)` --semantically_similar_to--> `Release v0.4.4 (Performance & UI Refinement)`  [INFERRED] [semantically similar]
  RELEASE.md → CHANGELOG.md
- `OrgWallet Android Adaptive Icon` --semantically_similar_to--> `OrgWallet Primary App Icon`  [INFERRED] [semantically similar]
  assets/adaptive-icon.png → assets/icon.png
- `OrgWallet Web Favicon` --semantically_similar_to--> `OrgWallet Primary App Icon`  [INFERRED] [semantically similar]
  assets/favicon.png → assets/icon.png
- `OrgWallet Brand Logo` --semantically_similar_to--> `OrgWallet Primary App Icon`  [INFERRED] [semantically similar]
  assets/logo.jpg → assets/icon.png

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Triad Context & Architecture Routing Workflow** — gemini_context_architecture_routing, gemini_graph_report, gemini_obsidian_devbrain, gemini_icm_staged_execution [EXTRACTED 1.00]
- **iOS Beta Installation Paths** — ios_beta_release_plan_path_a_eas_adhoc, ios_beta_release_plan_path_b_apple_testflight, ios_beta_release_plan_path_c_local_sideloading [EXTRACTED 1.00]
- **Free Apple ID Testing Phases** — ios_beta_release_plan_expo_go_live_testing, ios_beta_release_plan_local_usb_installation, ios_beta_release_plan_sidestore [EXTRACTED 1.00]
- **Pre-Flight Build Configuration Pipeline** — ios_beta_release_plan_app_json_config, ios_beta_release_plan_eas_json_config, ios_beta_release_plan_platform_guarding [EXTRACTED 1.00]
- **Offline-First Personal Wallet Architecture** — readme_offline_sqlite_engine, readme_sync_engine, changelog_sqlite_mutex_withlock, changelog_net_balance_engine, readme_rule_2_personal_wallet_resolution [EXTRACTED 1.00]
- **Cross-Platform Mobile Release & Distribution Pipeline (Android & iOS)** — release_google_play_guide, ios_beta_release_plan_doc, changelog_v0_4_4, readme_orgwallet [INFERRED 0.95]

## Communities (22 total, 5 thin omitted)

### Community 0 - "Core Offline SQLite & UI Styling"
Cohesion: 0.06
Nodes (62): RFC-4122, RFC-5322, expo-linking, expo-router, expo-sqlite, lucide-react-native, react, react-native (+54 more)

### Community 1 - "Screens & Transaction Modals"
Cohesion: 0.13
Nodes (16): react, AccountsScreen(), DashboardScreen(), TabsLayout(), SettingsScreen(), load(), TransactionsScreen(), AddTransactionModal() (+8 more)

### Community 2 - "Expo App Configuration"
Cohesion: 0.05
Nodes (38): backgroundColor, foregroundImage, monochromeImage, adaptiveIcon, icon, package, permissions, versionCode (+30 more)

### Community 3 - "iOS SwiftUI WidgetKit Extension"
Cohesion: 0.11
Nodes (12): OrgWalletEntry, OrgWalletProvider, OrgWalletWidget, .body, OrgWalletWidgetEntryView, .body, .content, QuickActionButton (+4 more)

### Community 4 - "Wallet Auth & Session Resolver"
Cohesion: 0.14
Nodes (12): AuthCallbackScreen(), handleAuthCallback(), LoginScreen(), IndexScreen(), checkAuthAndRoute(), init(), init(), init() (+4 more)

### Community 5 - "Expo Runtime Dependencies"
Cohesion: 0.07
Nodes (27): dependencies, expo, expo-background-task, expo-constants, expo-linking, expo-router, expo-secure-store, expo-sqlite (+19 more)

### Community 6 - "Package Manifest & Core Libs"
Cohesion: 0.09
Nodes (21): main, name, private, version, @babel/core, babel-preset-expo, expo-constants, @expo/ngrok (+13 more)

### Community 7 - "Release History & Architecture Docs"
Cohesion: 0.12
Nodes (16): Google OAuth Sign-In Transient Error Popup, Known Bugs Log (v0.4.1), Total Net Balance Pagination Calculation Discrepancy, Accurate Net Balance Engine, OrgWallet, Release v0.1.0 (Initial Beta Release), Release v0.2.0 (Live Android Home Screen Widget & Branding), Release v0.3.0 (Offline Transaction & Sub-Account Management) (+8 more)

### Community 8 - "Cross-Platform Widget Bridge & Handlers"
Cohesion: 0.15
Nodes (8): IOS_APP_GROUP, OrgWalletIosWidget, OrgWalletIosWidgetNativeModule, react-native-android-widget, getAndroidHexColor(), OrgWalletWidget(), OrgWalletWidgetProps, widgetTaskHandler()

### Community 9 - "iOS Widget Config Plugin & Bundler"
Cohesion: 0.12
Nodes (8): config, { getDefaultConfig }, fs, path, {
  withEntitlementsPlist,
  withXcodeProject,
  withDangerousMod,
}, expo, code, fs

### Community 11 - "iOS Beta & SideStore Release Plan"
Cohesion: 0.22
Nodes (14): App.json iOS Configuration, iOS Developer Mode Setup, OrgWallet iOS Beta Release Plan, EAS Cloud Build Service, Eas.json Build Profiles, Expo Go Live Beta Testing, iPhone XR Hardware & UI Verification Checklist, Local Native Installation via USB (+6 more)

### Community 12 - "Background Sync & Root Layout"
Cohesion: 0.22
Nodes (9): expo-background-task, expo-status-bar, expo-task-manager, @react-native-community/netinfo, react-native-gesture-handler, RootLayout(), styles, BACKGROUND_SYNC_TASK (+1 more)

### Community 13 - "TypeScript Compiler Config"
Cohesion: 0.22
Nodes (8): expo/tsconfig.base, compilerOptions, baseUrl, jsx, paths, strict, extends, include

### Community 14 - "Brand Identity & App Icons"
Cohesion: 0.43
Nodes (7): OrgWallet Android Adaptive Icon, OrgWallet Web Favicon, OrgWallet Brand Color Palette (Dark Slate & Vibrant Orange), OrgWallet Primary App Icon, Wallet Sync & Financial Analytics Visual Motif, OrgWallet Brand Identity (Dark Slate Wallet, Orange Sync Arrows & Analytics Bar Chart), OrgWallet Brand Logo

### Community 15 - "NPM Build & Run Scripts"
Cohesion: 0.29
Nodes (7): scripts, android, ios, package:ipa, start, typecheck, web

### Community 16 - "TypeScript & Babel Dev Tooling"
Cohesion: 0.33
Nodes (6): devDependencies, @babel/core, babel-preset-expo, @expo/ngrok, @types/react, typescript

### Community 17 - "Material Top Tabs Navigation"
Cohesion: 0.40
Nodes (3): @react-navigation/material-top-tabs, MaterialTopTabs, { Navigator }

## Knowledge Gaps
- **31 isolated node(s):** `expo-constants`, `expo-secure-store`, `expo-system-ui`, `react-dom`, `react-native-pager-view` (+26 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 179 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Expo Runtime Dependencies` to `Screens & Transaction Modals`, `Package Manifest & Core Libs`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **What connects `expo-constants`, `expo-secure-store`, `expo-system-ui` to the rest of the system?**
  _31 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Core Offline SQLite & UI Styling` be split into smaller, more focused modules?**
  _Cohesion score 0.06445350417394681 - nodes in this community are weakly interconnected._
- **Why does `react-native` connect `Core Offline SQLite & UI Styling` to `Cross-Platform Widget Bridge & Handlers`, `Background Sync & Root Layout`, `Package Manifest & Core Libs`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `Screens & Transaction Modals` be split into smaller, more focused modules?**
  _Cohesion score 0.12522686025408347 - nodes in this community are weakly interconnected._
- **Why does `expo` connect `iOS Widget Config Plugin & Bundler` to `Package Manifest & Core Libs`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `Expo App Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._