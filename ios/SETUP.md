# Pocket Wardrobe — iOS Setup

The repo already contains the Xcode project. Do not create a new project unless you are intentionally replacing the existing one.

## Requirements

- Xcode 16 or newer preferred.
- macOS with an installed iOS Simulator runtime.
- Apple ID/development team only required for physical-device builds.

## Open The Project

Open:

```text
ios/PocketWardrobev5/PocketWardrobev5.xcodeproj
```

The main scheme is `PocketWardrobev5`.

## Local Secrets

`Config/Secrets.plist` is ignored by git. If you need live Supabase values:

1. Copy `ios/PocketWardrobev5/PocketWardrobev5/Config/Secrets.example.plist`.
2. Save it as `ios/PocketWardrobev5/PocketWardrobev5/Config/Secrets.plist`.
3. Fill in the Supabase URL and anon key.

The current UI still runs from `SampleData.swift`; secrets are only needed for live integration work.

## Simulator Build Check

From the repository root:

```bash
xcodebuild -project ios/PocketWardrobev5/PocketWardrobev5.xcodeproj \
  -scheme PocketWardrobev5 \
  -destination 'generic/platform=iOS Simulator' \
  -configuration Debug build
```

Expected result:

```text
** BUILD SUCCEEDED **
```

## Unit Test Smoke Check

```bash
xcodebuild test -project ios/PocketWardrobev5/PocketWardrobev5.xcodeproj \
  -scheme PocketWardrobev5 \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -only-testing:PocketWardrobev5Tests
```

Expected result:

```text
** TEST SUCCEEDED **
```

## Run In Xcode

1. Open the project in Xcode.
2. Select the `PocketWardrobev5` scheme.
3. Select an iPhone Simulator.
4. Press Run.

## Run On A Phone

1. Select the `PocketWardrobev5` target.
2. In Signing & Capabilities, enable automatic signing.
3. Choose your Apple development team.
4. If the bundle identifier is already taken, change it from `com.melandwes.PocketWardrobev5` to a unique reverse-DNS value.
5. Connect your iPhone, choose it as the destination, and Run.

Free Apple ID signing expires after seven days; rerun from Xcode to renew.

## Current Gaps

- Supabase Swift package is installed, but auth/data services are not wired through the UI yet.
- Sample data still powers the current screens.
- Camera/photo ingestion is still future work.
- The app has no full launch-screen or production app icon pass yet.
