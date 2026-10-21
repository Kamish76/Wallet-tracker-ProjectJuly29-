import ExpoModulesCore
import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

private struct SharedWidgetPayload: Codable {
  let balance: String
  let opacity: Double
  let theme: String?
  let isDark: Bool?
  let updatedAt: Double
}

public class OrgWalletIosWidgetModule: Module {
  private let defaultAppGroup = "group.com.kamish.orgfinance"
  private let baseBundleId = "com.kamish.orgfinance"
  private let balanceKey = "orgwallet_widget_balance"
  private let opacityKey = "orgwallet_widget_opacity"
  private let themeKey = "orgwallet_widget_theme"
  private let isDarkKey = "orgwallet_widget_is_dark"
  private let updatedAtKey = "orgwallet_widget_updated_at"
  private let sharedPayloadFileName = "orgwallet_widget_data.json"

  /// Resolves all candidate App Group identifiers, supporting both standard Xcode signing
  /// (`group.com.kamish.orgfinance`) and SideStore / AltStore Free Apple ID signing
  /// (`group.com.kamish.orgfinance.<TEAM_ID>`).
  private func candidateAppGroups(preferred: String?) -> [String] {
    var groups: [String] = []
    let trimChars = CharacterSet(charactersIn: ". \t\n\r")
    func appendUnique(_ value: String) {
      let trimmed = value.trimmingCharacters(in: trimChars)
      if trimmed.hasPrefix("group.") && trimmed.count > 6 && !groups.contains(trimmed) {
        groups.append(trimmed)
      }
    }

    // 1. Inspect signed Mach-O binary, embedded.mobileprovision, and archived-expanded-entitlements.xcent
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

    // 2. Derive from main app bundle identifier
    if let bundleId = Bundle.main.bundleIdentifier {
      let normalizedBundleId = bundleId
        .replacingOccurrences(of: ".widget", with: "")
      appendUnique("group.\(normalizedBundleId)")

      if normalizedBundleId.hasPrefix(baseBundleId + ".") {
        let suffix = String(normalizedBundleId.dropFirst((baseBundleId + ".").count))
        if !suffix.isEmpty {
          appendUnique("\(defaultAppGroup).\(suffix)")
        }
      }
    }

    // 3. Preferred and default App Group identifiers
    if let preferred = preferred {
      appendUnique(preferred)
    }
    appendUnique(defaultAppGroup)

    return groups
  }

  public func definition() -> ModuleDefinition {
    Name("OrgWalletIosWidget")

    AsyncFunction("setWidgetData") { (balance: String, opacity: Double, theme: String?, isDark: Bool?, appGroup: String?) -> Bool in
      let clampedOpacity = min(1.0, max(0.1, opacity))
      let effectiveTheme = theme ?? "auto"
      let resolvedIsDark = isDark ?? (effectiveTheme == "light" ? false : true)
      let timestamp = Date().timeIntervalSince1970
      let payload = SharedWidgetPayload(
        balance: balance,
        opacity: clampedOpacity,
        theme: effectiveTheme,
        isDark: resolvedIsDark,
        updatedAt: timestamp
      )
      let encodedPayload = try? JSONEncoder().encode(payload)

      for suiteName in self.candidateAppGroups(preferred: appGroup) {
        if let sharedDefaults = UserDefaults(suiteName: suiteName) {
          sharedDefaults.set(balance, forKey: self.balanceKey)
          sharedDefaults.set(clampedOpacity, forKey: self.opacityKey)
          sharedDefaults.set(effectiveTheme, forKey: self.themeKey)
          sharedDefaults.set(resolvedIsDark, forKey: self.isDarkKey)
          sharedDefaults.set(timestamp, forKey: self.updatedAtKey)
          sharedDefaults.synchronize()
        }

        if let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: suiteName),
           let data = encodedPayload {
          let fileURL = containerURL.appendingPathComponent(self.sharedPayloadFileName)
          try? data.write(to: fileURL, options: [.atomic])
        }
      }

      // Also mirror into standard UserDefaults as a local fallback
      UserDefaults.standard.set(balance, forKey: self.balanceKey)
      UserDefaults.standard.set(clampedOpacity, forKey: self.opacityKey)
      UserDefaults.standard.set(effectiveTheme, forKey: self.themeKey)
      UserDefaults.standard.set(resolvedIsDark, forKey: self.isDarkKey)

      #if canImport(WidgetKit)
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
      #endif
      return true
    }

    AsyncFunction("clearWidgetData") { (appGroup: String?) -> Bool in
      for suiteName in self.candidateAppGroups(preferred: appGroup) {
        if let sharedDefaults = UserDefaults(suiteName: suiteName) {
          sharedDefaults.removeObject(forKey: self.balanceKey)
          sharedDefaults.removeObject(forKey: self.themeKey)
          sharedDefaults.removeObject(forKey: self.updatedAtKey)
          sharedDefaults.synchronize()
        }

        if let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: suiteName) {
          let fileURL = containerURL.appendingPathComponent(self.sharedPayloadFileName)
          try? FileManager.default.removeItem(at: fileURL)
        }
      }
      UserDefaults.standard.removeObject(forKey: self.balanceKey)
      UserDefaults.standard.removeObject(forKey: self.themeKey)

      #if canImport(WidgetKit)
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
      #endif
      return true
    }

    AsyncFunction("reloadWidget") { () -> Bool in
      #if canImport(WidgetKit)
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
      #endif
      return true
    }
  }
}
