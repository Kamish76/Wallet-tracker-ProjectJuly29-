import WidgetKit
import SwiftUI

private let defaultAppGroupIdentifier = "group.com.kamish.orgfinance"
private let baseBundleIdentifier = "com.kamish.orgfinance"
private let balanceKey = "orgwallet_widget_balance"
private let opacityKey = "orgwallet_widget_opacity"
private let themeKey = "orgwallet_widget_theme"
private let sharedPayloadFileName = "orgwallet_widget_data.json"

private struct SharedWidgetPayload: Codable {
  let balance: String
  let opacity: Double
  let theme: String?
  let isDark: Bool?
  let updatedAt: Double?
}

struct OrgWalletEntry: TimelineEntry {
  let date: Date
  let balance: String
  let opacity: Double
  let theme: String // "auto", "light", "dark"
  let isDark: Bool
}

struct OrgWalletProvider: TimelineProvider {
  func placeholder(in context: Context) -> OrgWalletEntry {
    OrgWalletEntry(date: Date(), balance: "₱0.00", opacity: 0.85, theme: "auto", isDark: true)
  }

  func getSnapshot(in context: Context, completion: @escaping (OrgWalletEntry) -> Void) {
    completion(loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<OrgWalletEntry>) -> Void) {
    let entry = loadEntry()
    // Refresh periodically every 15 minutes or whenever the main app calls reloadAllTimelines()
    let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
    let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
    completion(timeline)
  }

  /// Resolves all candidate App Group identifiers, supporting both standard Xcode builds
  /// (`group.com.kamish.orgfinance`) and SideStore / AltStore Free Apple ID builds
  /// (`group.com.kamish.orgfinance.<TEAM_ID>`).
  private func candidateAppGroups() -> [String] {
    var groups: [String] = []
    let trimChars = CharacterSet(charactersIn: ". \t\n\r")
    func appendUnique(_ value: String) {
      let trimmed = value.trimmingCharacters(in: trimChars)
      if trimmed.hasPrefix("group.") && trimmed.count > 6 && !groups.contains(trimmed) {
        groups.append(trimmed)
      }
    }

    // 1. Inspect signed Mach-O binary, embedded.mobileprovision, and archived-expanded-entitlements.xcent first
    let bundleURL = Bundle.main.bundleURL
    var entitlementFiles: [URL] = [
      bundleURL.appendingPathComponent("archived-expanded-entitlements.xcent"),
      bundleURL.appendingPathComponent("embedded.mobileprovision")
    ]
    if let execURL = Bundle.main.executableURL {
      entitlementFiles.append(execURL)
    }
    for fileURL in entitlementFiles {
      if let data = try? Data(contentsOf: fileURL),
         let content = String(data: data, encoding: .isoLatin1) {
        let pattern = "<string>(group\\.[A-Za-z0-9._-]+)</string>"
        if let regex = try? NSRegularExpression(pattern: pattern, options: []) {
          let nsRange = NSRange(content.startIndex..<content.endIndex, in: content)
          let matches = regex.matches(in: content, options: [], range: nsRange)
          for match in matches {
            if match.numberOfRanges > 1, let range = Range(match.range(at: 1), in: content) {
              appendUnique(String(content[range]))
            }
          }
        }
      }
    }

    // 2. Derive from widget extension bundle identifier (stripping `.widget`)
    if let bundleId = Bundle.main.bundleIdentifier {
      let normalizedBundleId = bundleId.replacingOccurrences(of: ".widget", with: "")
      appendUnique("group.\(normalizedBundleId)")

      if normalizedBundleId.hasPrefix(baseBundleIdentifier + ".") {
        let suffix = String(normalizedBundleId.dropFirst((baseBundleIdentifier + ".").count))
        if !suffix.isEmpty {
          appendUnique("\(defaultAppGroupIdentifier).\(suffix)")
        }
      }
    }

    // 3. Default App Group identifier
    appendUnique(defaultAppGroupIdentifier)

    return groups
  }

  private func loadEntry() -> OrgWalletEntry {
    let groups = candidateAppGroups()
    var fallbackOpacity: Double? = nil
    var fallbackTheme: String? = nil

    // Pass 1: Read directly from the shared App Group container file (bypasses cfprefsd cache delays)
    for groupId in groups {
      if let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupId) {
        let fileURL = containerURL.appendingPathComponent(sharedPayloadFileName)
        if let data = try? Data(contentsOf: fileURL),
           let payload = try? JSONDecoder().decode(SharedWidgetPayload.self, from: data) {
          let opacity = min(1.0, max(0.1, payload.opacity))
          fallbackOpacity = opacity
          let theme = payload.theme ?? "auto"
          fallbackTheme = theme
          let isDark = payload.isDark ?? (theme == "light" ? false : true)
          if !payload.balance.isEmpty {
            return OrgWalletEntry(date: Date(), balance: payload.balance, opacity: opacity, theme: theme, isDark: isDark)
          }
        }
      }
    }

    // Pass 2: Read from shared App Group UserDefaults
    for groupId in groups {
      if let sharedDefaults = UserDefaults(suiteName: groupId) {
        let storedBalance = sharedDefaults.string(forKey: balanceKey)
        let storedTheme = sharedDefaults.string(forKey: themeKey) ?? "auto"
        let storedIsDark = sharedDefaults.object(forKey: "orgwallet_widget_is_dark") as? Bool ?? (storedTheme == "light" ? false : true)
        if let storedOpacity = sharedDefaults.object(forKey: opacityKey) as? Double {
          fallbackOpacity = min(1.0, max(0.1, storedOpacity))
        }
        fallbackTheme = storedTheme
        if let balance = storedBalance, !balance.isEmpty {
          let opacity = fallbackOpacity ?? 0.85
          return OrgWalletEntry(date: Date(), balance: balance, opacity: opacity, theme: storedTheme, isDark: storedIsDark)
        }
      }
    }

    return OrgWalletEntry(date: Date(), balance: "$0.00", opacity: fallbackOpacity ?? 0.85, theme: fallbackTheme ?? "auto", isDark: true)
  }
}

struct QuickActionButton: View {
  let symbol: String
  let symbolColor: Color
  let backgroundColor: Color
  let destinationURL: String
  var fixedSize: CGFloat? = 52
  var height: CGFloat = 52
  var cornerRadius: CGFloat = 16
  var fontSize: CGFloat = 24

  var body: some View {
    if let url = URL(string: destinationURL) {
      Link(destination: url) {
        ZStack {
          RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(backgroundColor)

          Text(symbol)
            .font(.system(size: fontSize, weight: .bold))
            .foregroundColor(symbolColor)
        }
        .frame(maxWidth: fixedSize ?? .infinity)
        .frame(width: fixedSize, height: height)
      }
    }
  }
}

struct OrgWalletWidgetEntryView: View {
  @Environment(\.widgetFamily) private var family
  @Environment(\.colorScheme) private var systemColorScheme
  var entry: OrgWalletProvider.Entry

  private var isDark: Bool {
    switch entry.theme {
    case "light":
      return false
    case "dark":
      return true
    default:
      // "auto": Use resolved isDark from the host app, and also respect systemColorScheme if dark
      return systemColorScheme == .dark || entry.isDark
    }
  }

  // Exact color tokens matching OrgWallet Light/Dark design system
  private var baseSurfaceColor: Color {
    isDark
      ? Color(red: 32.0 / 255.0, green: 32.0 / 255.0, blue: 32.0 / 255.0)
      : Color.white
  }

  private var balanceTextColor: Color {
    isDark
      ? .white
      : Color(red: 15.0 / 255.0, green: 23.0 / 255.0, blue: 42.0 / 255.0) // #0F172A
  }

  private var labelTextColor: Color {
    isDark
      ? Color(red: 209.0 / 255.0, green: 213.0 / 255.0, blue: 219.0 / 255.0) // #D1D5DB
      : Color(red: 100.0 / 255.0, green: 116.0 / 255.0, blue: 139.0 / 255.0) // #64748B
  }

  // Expense
  private var expenseText: Color {
    isDark
      ? Color(red: 244.0 / 255.0, green: 63.0 / 255.0, blue: 94.0 / 255.0) // #F43F5E
      : Color(red: 225.0 / 255.0, green: 29.0 / 255.0, blue: 72.0 / 255.0) // #E11D48
  }
  private var expenseBg: Color {
    isDark
      ? Color(red: 42.0 / 255.0, green: 24.0 / 255.0, blue: 28.0 / 255.0) // #2A181C
      : Color(red: 254.0 / 255.0, green: 226.0 / 255.0, blue: 226.0 / 255.0) // #FEE2E2
  }

  // Income
  private var incomeText: Color {
    isDark
      ? Color(red: 16.0 / 255.0, green: 185.0 / 255.0, blue: 129.0 / 255.0) // #10B981
      : Color(red: 5.0 / 255.0, green: 150.0 / 255.0, blue: 105.0 / 255.0) // #059669
  }
  private var incomeBg: Color {
    isDark
      ? Color(red: 16.0 / 255.0, green: 40.0 / 255.0, blue: 31.0 / 255.0) // #10281F
      : Color(red: 220.0 / 255.0, green: 252.0 / 255.0, blue: 231.0 / 255.0) // #DCFCE7
  }

  // Transfer
  private var transferText: Color {
    isDark
      ? Color(red: 59.0 / 255.0, green: 130.0 / 255.0, blue: 246.0 / 255.0) // #3B82F6
      : Color(red: 37.0 / 255.0, green: 99.0 / 255.0, blue: 235.0 / 255.0) // #2563EB
  }
  private var transferBg: Color {
    isDark
      ? Color(red: 20.0 / 255.0, green: 34.0 / 255.0, blue: 56.0 / 255.0) // #142238
      : Color(red: 219.0 / 255.0, green: 234.0 / 255.0, blue: 254.0 / 255.0) // #DBEAFE
  }

  // 2x2 Compact Layout (.systemSmall)
  private var smallContent: some View {
    VStack(alignment: .leading, spacing: 0) {
      if let homeURL = URL(string: "orgwallet://home") {
        Link(destination: homeURL) {
          VStack(alignment: .leading, spacing: 4) {
            Text("All accounts")
              .font(.system(size: 12, weight: .medium))
              .foregroundColor(labelTextColor)
              .lineLimit(1)

            Text(entry.balance)
              .font(.system(size: 21, weight: .bold))
              .foregroundColor(balanceTextColor)
              .lineLimit(1)
              .minimumScaleFactor(0.5)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
      }

      Spacer(minLength: 8)

      HStack(spacing: 7) {
        QuickActionButton(
          symbol: "↑",
          symbolColor: expenseText,
          backgroundColor: expenseBg,
          destinationURL: "orgwallet://add-transaction?type=expense_personal",
          fixedSize: nil,
          height: 44,
          cornerRadius: 13,
          fontSize: 20
        )

        QuickActionButton(
          symbol: "↓",
          symbolColor: incomeText,
          backgroundColor: incomeBg,
          destinationURL: "orgwallet://add-transaction?type=income",
          fixedSize: nil,
          height: 44,
          cornerRadius: 13,
          fontSize: 20
        )

        QuickActionButton(
          symbol: "⇄",
          symbolColor: transferText,
          backgroundColor: transferBg,
          destinationURL: "orgwallet://add-transaction?type=transfer",
          fixedSize: nil,
          height: 44,
          cornerRadius: 13,
          fontSize: 20
        )
      }
    }
    .padding(14)
  }

  // 2x4 Horizontal Layout (.systemMedium)
  private var mediumContent: some View {
    HStack(alignment: .center, spacing: 8) {
      // Left side: Account label & Total Net Balance -> Opens Dashboard
      if let homeURL = URL(string: "orgwallet://home") {
        Link(destination: homeURL) {
          VStack(alignment: .leading, spacing: 4) {
            Text("All accounts")
              .font(.system(size: 13, weight: .regular))
              .foregroundColor(labelTextColor)
              .lineLimit(1)

            Text(entry.balance)
              .font(.system(size: 20, weight: .bold))
              .foregroundColor(balanceTextColor)
              .lineLimit(1)
              .minimumScaleFactor(0.6)
          }
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
      }

      // Right side: Three square Quick Action buttons
      HStack(spacing: 6) {
        QuickActionButton(
          symbol: "↑",
          symbolColor: expenseText,
          backgroundColor: expenseBg,
          destinationURL: "orgwallet://add-transaction?type=expense_personal"
        )

        QuickActionButton(
          symbol: "↓",
          symbolColor: incomeText,
          backgroundColor: incomeBg,
          destinationURL: "orgwallet://add-transaction?type=income"
        )

        QuickActionButton(
          symbol: "⇄",
          symbolColor: transferText,
          backgroundColor: transferBg,
          destinationURL: "orgwallet://add-transaction?type=transfer"
        )
      }
    }
    .padding(.horizontal, 18)
    .padding(.vertical, 12)
  }

  @ViewBuilder
  private var activeContent: some View {
    if family == .systemSmall {
      smallContent
    } else {
      mediumContent
    }
  }

  var body: some View {
    Group {
      if #available(iOSApplicationExtension 17.0, *) {
        activeContent
          .widgetURL(URL(string: "orgwallet://home"))
          .containerBackground(for: .widget) {
            baseSurfaceColor
          }
      } else {
        ZStack {
          baseSurfaceColor
          activeContent
        }
        .widgetURL(URL(string: "orgwallet://home"))
      }
    }
    .preferredColorScheme(isDark ? .dark : .light)
  }
}

@main
struct OrgWalletWidget: Widget {
  let kind: String = "OrgWalletBalance"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: OrgWalletProvider()) { entry in
      OrgWalletWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("OrgWallet Balance & Quick Actions")
    .description("Quickly view your balance and add transactions (2x2 Small or 2x4 Medium)")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabledIfAvailable()
  }
}

extension WidgetConfiguration {
  func contentMarginsDisabledIfAvailable() -> some WidgetConfiguration {
    if #available(iOSApplicationExtension 17.0, *) {
      return self.contentMarginsDisabled()
    } else {
      return self
    }
  }
}
