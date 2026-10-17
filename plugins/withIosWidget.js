const {
  withEntitlementsPlist,
  withXcodeProject,
  withDangerousMod,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const APP_GROUP_IDENTIFIER = 'group.com.kamish.orgfinance';
const WIDGET_TARGET_NAME = 'OrgWalletWidgetExtension';
const WIDGET_FOLDER_NAME = 'OrgWalletWidget';
const WIDGET_BUNDLE_SUFFIX = 'widget';

/**
 * 1. Adds the shared App Group (`group.com.kamish.orgfinance`) to the main iOS app entitlements.
 */
function withWidgetAppGroupEntitlements(config) {
  return withEntitlementsPlist(config, (modConfig) => {
    const existing = modConfig.modResults['com.apple.security.application-groups'] || [];
    if (!existing.includes(APP_GROUP_IDENTIFIER)) {
      modConfig.modResults['com.apple.security.application-groups'] = [
        ...existing,
        APP_GROUP_IDENTIFIER,
      ];
    }
    return modConfig;
  });
}

/**
 * 2. Copies SwiftUI widget files (`OrgWalletWidget.swift`, `Info.plist`, `OrgWalletWidget.entitlements`)
 *    into `ios/OrgWalletWidget/` during iOS prebuild.
 */
function withWidgetSourceFiles(config) {
  return withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const platformProjectRoot = modConfig.modRequest.platformProjectRoot;
      const sourceDir = path.join(projectRoot, 'plugins', 'ios-widget');
      const targetDir = path.join(platformProjectRoot, WIDGET_FOLDER_NAME);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filesToCopy = [
        'OrgWalletWidget.swift',
        'Info.plist',
        'OrgWalletWidget.entitlements',
      ];

      for (const file of filesToCopy) {
        const srcPath = path.join(sourceDir, file);
        const destPath = path.join(targetDir, file);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
        }
      }

      return modConfig;
    },
  ]);
}

/**
 * 3. Adds the `OrgWalletWidgetExtension` target to `ios/OrgWallet.xcodeproj/project.pbxproj`
 *    and configures build settings & Embed App Extensions phase.
 */
function withWidgetXcodeTarget(config) {
  return withXcodeProject(config, (modConfig) => {
    const xcodeProject = modConfig.modResults;

    // Avoid duplicate target registration if prebuild runs without --clean
    if (xcodeProject.pbxTargetByName(WIDGET_TARGET_NAME)) {
      return modConfig;
    }

    const mainBundleId = config.ios?.bundleIdentifier || 'com.kamish.orgfinance';
    const widgetBundleId = `${mainBundleId}.${WIDGET_BUNDLE_SUFFIX}`;
    const marketingVersion = config.version || '0.4.4';
    const currentProjectVersion = config.ios?.buildNumber || '9';

    // Create PBXGroup for OrgWalletWidget files
    const widgetGroup = xcodeProject.addPbxGroup(
      ['OrgWalletWidget.swift', 'Info.plist', 'OrgWalletWidget.entitlements'],
      WIDGET_FOLDER_NAME,
      WIDGET_FOLDER_NAME
    );

    // Attach group to main project root group
    const mainProject = xcodeProject.getFirstProject().firstProject;
    if (mainProject && mainProject.mainGroup) {
      xcodeProject.addToPbxGroup(widgetGroup.uuid, mainProject.mainGroup);
    }

    // Ensure PBXTargetDependency and PBXContainerItemProxy sections exist so addTarget links the dependency
    if (!xcodeProject.hash.project.objects['PBXTargetDependency']) {
      xcodeProject.hash.project.objects['PBXTargetDependency'] = {};
    }
    if (!xcodeProject.hash.project.objects['PBXContainerItemProxy']) {
      xcodeProject.hash.project.objects['PBXContainerItemProxy'] = {};
    }

    // Add App Extension target (`app_extension` automatically creates CopyFiles "Embed App Extensions" on main target)
    const target = xcodeProject.addTarget(
      WIDGET_TARGET_NAME,
      'app_extension',
      WIDGET_FOLDER_NAME,
      widgetBundleId
    );

    // Add build phases to the widget extension target
    xcodeProject.addBuildPhase(
      ['OrgWalletWidget.swift'],
      'PBXSourcesBuildPhase',
      'Sources',
      target.uuid
    );

    xcodeProject.addBuildPhase(
      [],
      'PBXResourcesBuildPhase',
      'Resources',
      target.uuid
    );

    xcodeProject.addBuildPhase(
      ['WidgetKit.framework', 'SwiftUI.framework'],
      'PBXFrameworksBuildPhase',
      'Frameworks',
      target.uuid
    );

    // Configure Build Settings for the widget extension target
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const buildConfig = configurations[key];
      if (
        typeof buildConfig === 'object' &&
        buildConfig.buildSettings &&
        buildConfig.buildSettings.PRODUCT_NAME === `"${WIDGET_TARGET_NAME}"`
      ) {
        Object.assign(buildConfig.buildSettings, {
          CLANG_ENABLE_MODULES: 'YES',
          CODE_SIGN_ENTITLEMENTS: `${WIDGET_FOLDER_NAME}/OrgWalletWidget.entitlements`,
          CODE_SIGN_STYLE: 'Automatic',
          CURRENT_PROJECT_VERSION: `"${currentProjectVersion}"`,
          GENERATE_INFOPLIST_FILE: 'NO',
          INFOPLIST_FILE: `${WIDGET_FOLDER_NAME}/Info.plist`,
          IPHONEOS_DEPLOYMENT_TARGET: '15.1',
          LD_RUNPATH_SEARCH_PATHS:
            '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
          MARKETING_VERSION: `"${marketingVersion}"`,
          PRODUCT_BUNDLE_IDENTIFIER: `"${widgetBundleId}"`,
          SKIP_INSTALL: 'YES',
          SWIFT_EMIT_LOC_STRINGS: 'YES',
          SWIFT_VERSION: '5.0',
          TARGETED_DEVICE_FAMILY: '"1,2"',
        });
      }
    }

    return modConfig;
  });
}

module.exports = function withIosWidget(config) {
  config = withWidgetAppGroupEntitlements(config);
  config = withWidgetSourceFiles(config);
  config = withWidgetXcodeTarget(config);
  return config;
};
