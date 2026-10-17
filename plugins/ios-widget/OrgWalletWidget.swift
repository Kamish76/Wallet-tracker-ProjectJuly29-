import WidgetKit
import SwiftUI

private let appGroupIdentifier = "group.com.kamish.orgfinance"
private let balanceKey = "orgwallet_widget_balance"
private let opacityKey = "orgwallet_widget_opacity"

struct OrgWalletEntry: TimelineEntry {
  let date: Date
  let balance: String
  let opacity: Double
}

struct OrgWalletProvider: TimelineProvider {
  func placeholder(in context: Context) -> OrgWalletEntry {
    OrgWalletEntry(date: Date(), balance: "₱0.00", opacity: 0.85)
  }

  func getSnapshot(in context: Context, completion: @escaping (OrgWalletEntry) -> Void) {
    completion(loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<OrgWalletEntry>) -> Void) {
    let entry = loadEntry()
    // Refresh periodically every 30 minutes or whenever the main app calls reloadAllTimelines()
    let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
    let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
    completion(timeline)
  }

  private func loadEntry() -> OrgWalletEntry {
    if let sharedDefaults = UserDefaults(suiteName: appGroupIdentifier) {
      let storedBalance = sharedDefaults.string(forKey: balanceKey)
      let storedOpacity = sharedDefaults.object(forKey: opacityKey) as? Double

      let balance = (storedBalance?.isEmpty == false) ? storedBalance! : "$0.00"
      let opacity = min(1.0, max(0.1, storedOpacity ?? 0.85))
      return OrgWalletEntry(date: Date(), balance: balance, opacity: opacity)
    }

    // Fallback if SideStore free Apple ID strips App Group entitlement
    return OrgWalletEntry(date: Date(), balance: "Open Wallet", opacity: 0.85)
  }
}

struct QuickActionButton: View {
  let symbol: String
  let symbolColor: Color
  let backgroundColor: Color
  let destinationURL: String

  var body: some View {
    if let url = URL(string: destinationURL) {
      Link(destination: url) {
        ZStack {
          RoundedRectangle(cornerRadius: 16, style: .continuous)
            .fill(backgroundColor)
            .frame(width: 52, height: 52)

          Text(symbol)
            .font(.system(size: 24, weight: .bold))
            .foregroundColor(symbolColor)
        }
      }
    }
  }
}

struct OrgWalletWidgetEntryView: View {
  var entry: OrgWalletProvider.Entry

  // Exact color tokens matching src/widgets/OrgWalletWidget.tsx & src/theme/colors.ts
  private let baseSurfaceColor = Color(red: 32.0 / 255.0, green: 32.0 / 255.0, blue: 32.0 / 255.0)
  private let labelTextColor = Color(red: 209.0 / 255.0, green: 213.0 / 255.0, blue: 219.0 / 255.0) // #D1D5DB

  // Expense (#F43F5E on #2A181C)
  private let expenseText = Color(red: 244.0 / 255.0, green: 63.0 / 255.0, blue: 94.0 / 255.0)
  private let expenseBg = Color(red: 42.0 / 255.0, green: 24.0 / 255.0, blue: 28.0 / 255.0)

  // Income (#10B981 on #10281F)
  private let incomeText = Color(red: 16.0 / 255.0, green: 185.0 / 255.0, blue: 129.0 / 255.0)
  private let incomeBg = Color(red: 16.0 / 255.0, green: 40.0 / 255.0, blue: 31.0 / 255.0)

  // Transfer (#3B82F6 on #142238)
  private let transferText = Color(red: 59.0 / 255.0, green: 130.0 / 255.0, blue: 246.0 / 255.0)
  private let transferBg = Color(red: 20.0 / 255.0, green: 34.0 / 255.0, blue: 56.0 / 255.0)

  var content: some View {
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
              .foregroundColor(.white)
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

  var body: some View {
    if #available(iOSApplicationExtension 17.0, *) {
      content
        .containerBackground(for: .widget) {
          baseSurfaceColor.opacity(entry.opacity)
        }
    } else {
      ZStack {
        baseSurfaceColor.opacity(entry.opacity)
        content
      }
    }
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
    .description("Quickly view your balance and add transactions")
    .supportedFamilies([.systemMedium])
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
