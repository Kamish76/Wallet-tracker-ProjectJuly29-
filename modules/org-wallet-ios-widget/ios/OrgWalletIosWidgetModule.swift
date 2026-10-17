import ExpoModulesCore
import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

public class OrgWalletIosWidgetModule: Module {
  private let defaultAppGroup = "group.com.kamish.orgfinance"
  private let balanceKey = "orgwallet_widget_balance"
  private let opacityKey = "orgwallet_widget_opacity"
  private let updatedAtKey = "orgwallet_widget_updated_at"

  public func definition() -> ModuleDefinition {
    Name("OrgWalletIosWidget")

    AsyncFunction("setWidgetData") { (balance: String, opacity: Double, appGroup: String?) -> Bool in
      let suiteName = appGroup ?? self.defaultAppGroup
      let clampedOpacity = min(1.0, max(0.1, opacity))

      if let sharedDefaults = UserDefaults(suiteName: suiteName) {
        sharedDefaults.set(balance, forKey: self.balanceKey)
        sharedDefaults.set(clampedOpacity, forKey: self.opacityKey)
        sharedDefaults.set(Date().timeIntervalSince1970, forKey: self.updatedAtKey)
        sharedDefaults.synchronize()
      }

      // Also mirror into standard UserDefaults as a local fallback
      UserDefaults.standard.set(balance, forKey: self.balanceKey)
      UserDefaults.standard.set(clampedOpacity, forKey: self.opacityKey)

      #if canImport(WidgetKit)
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
      #endif
      return true
    }

    AsyncFunction("clearWidgetData") { (appGroup: String?) -> Bool in
      let suiteName = appGroup ?? self.defaultAppGroup
      if let sharedDefaults = UserDefaults(suiteName: suiteName) {
        sharedDefaults.removeObject(forKey: self.balanceKey)
        sharedDefaults.removeObject(forKey: self.updatedAtKey)
        sharedDefaults.synchronize()
      }
      UserDefaults.standard.removeObject(forKey: self.balanceKey)

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
