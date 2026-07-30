# OrgWallet — Project-Scoped Rules

## Android Build — Java 25 Incompatibility Fix
This machine's system Java (`W:\Dev\JDK`) is **Java 25**, which outputs class file major version 69. Gradle 8.14.3 only supports up to Java 21 and will fail with `Unsupported class file major version 69`.

**Fix:** `android/gradle.properties` must always contain:
```
org.gradle.java.home=W:/Dev/Android/Android Studio/jbr
```
This points Gradle to Android Studio's bundled **OpenJDK 21** (`W:\Dev\Android\Android Studio\jbr`). If `npx expo prebuild --clean` regenerates `android/gradle.properties`, re-add this line before running `gradlew.bat`.
