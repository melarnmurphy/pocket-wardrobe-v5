# Pocket Wardrobe — iOS

Native SwiftUI prototype for Pocket Wardrobe. The active Xcode project is:

```text
ios/PocketWardrobev5/PocketWardrobev5.xcodeproj
```

The app currently builds as `PocketWardrobev5` and mirrors the main consumer surfaces:
Wardrobe, Lookbook, Trends, Planner/Diary, and Rules. It uses the same editorial product
direction as the web app: ivory surfaces, ink typography, restrained cards, and structured
wardrobe data.

## Current Verification

Last checked: 2026-05-07

```bash
xcodebuild -project ios/PocketWardrobev5/PocketWardrobev5.xcodeproj \
  -scheme PocketWardrobev5 \
  -destination 'generic/platform=iOS Simulator' \
  -configuration Debug build
```

Result: `BUILD SUCCEEDED`.

Unit test smoke check:

```bash
xcodebuild test -project ios/PocketWardrobev5/PocketWardrobev5.xcodeproj \
  -scheme PocketWardrobev5 \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -only-testing:PocketWardrobev5Tests
```

Result: `TEST SUCCEEDED`.

## Structure

```text
ios/
├── README.md
├── SETUP.md
└── PocketWardrobev5/
    ├── PocketWardrobev5.xcodeproj
    ├── PocketWardrobev5/
    │   ├── App/
    │   ├── Assets.xcassets/
    │   ├── Config/
    │   ├── Data/
    │   ├── DesignSystem/
    │   ├── Features/
    │   ├── Models/
    │   └── Resources/
    ├── PocketWardrobev5Tests/
    └── PocketWardrobev5UITests/
```

## Implemented Screens

| Surface | Status |
| --- | --- |
| Wardrobe | First-pass SwiftUI screen with sample garments and detail sheets |
| Lookbook | First-pass board/grid view with detail sheets |
| Trends | First-pass trend signal views and detail sheets |
| Planner | First-pass weekly planner with outfit variants |
| Diary | First-pass month view inside Planner |
| Rules | First-pass style rule list/detail views |

## Data And Integrations

- UI data is still hardcoded in `PocketWardrobev5/Data/SampleData.swift`.
- `supabase-swift` is added to the Xcode project, but live Supabase auth/data wiring is not complete.
- `Config/Secrets.example.plist` documents local secrets shape.
- `Config/Secrets.plist` is intentionally ignored by git.
- The app uses fixed remote sample imagery in places; replace with Supabase Storage URLs when data wiring lands.

## Known Gaps

- No production Supabase session/auth flow yet.
- No live wardrobe/lookbook/trend queries yet.
- No camera or PhotoPicker ingestion flow yet.
- No offline image asset fallback for all sample URLs.
- Device signing still needs a local Apple development team in Xcode.

## Notes

The old `ios/PocketWardrobe/` and shallow `ios/PocketWardrobev5/Features` paths were removed in favor of the nested Xcode project layout above. If git shows those old paths as deleted, that is expected cleanup rather than missing source.
