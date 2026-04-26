# Pocket Wardrobe — iOS Setup

Getting this onto your phone with Xcode + free Apple ID signing. ~10 minutes.

## What you need

- A Mac with **Xcode 15.3 or later** (Xcode 16 preferred).
- An **Apple ID** (the one you use for your phone). No paid developer account required.
- A **Lightning/USB-C cable** to connect your iPhone to your Mac.

## 1. Create the Xcode project

We're going to create a fresh SwiftUI project and drag the source files in. This avoids
any checked-in `.xcodeproj` bitrot.

1. Open Xcode → **File → New → Project…**
2. Choose **iOS → App** → Next.
3. Fill in:
   - **Product Name:** `PocketWardrobe`
   - **Team:** (leave "None" for now — we set it in step 3)
   - **Organization Identifier:** `io.pointto2.pocketwardrobe` (or your own reverse-DNS)
   - **Interface:** SwiftUI
   - **Language:** Swift
   - **Storage:** None
   - **Include Tests:** unchecked (you can add later)
4. Save it **inside this folder** — `ios/` — so you end up with
   `ios/PocketWardrobe/PocketWardrobe.xcodeproj`.
   When Xcode asks, leave "Create Git repository" unchecked (we're already in a repo).

Xcode will create its own `PocketWardrobe/` folder next to the `.xcodeproj`. **Delete**
the two files Xcode generated inside it — `PocketWardrobeApp.swift` and `ContentView.swift`
— because our `App/` folder has replacements.

## 2. Add the source files

In Finder, select the six folders inside `ios/PocketWardrobe/`:

```
App/  DesignSystem/  Models/  Data/  Features/  Resources/
```

Drag them into Xcode's file navigator, dropping them **inside the `PocketWardrobe` group**
(the one that has the app target icon). In the dialog:

- **Destination:** ✓ Copy items if needed (or leave unchecked if you want to keep them in
  the repo and reference-only — your call)
- **Added folders:** ● Create groups (not folder references)
- **Add to targets:** ✓ PocketWardrobe

Hit Finish.

## 3. Set your signing team

1. Click the project root in the file navigator → select the **PocketWardrobe** target.
2. Go to **Signing & Capabilities**.
3. Check **Automatically manage signing**.
4. In the **Team** dropdown, select "Add an Account…" if yours isn't listed, sign in with
   your Apple ID, then choose your "Personal Team".
5. The bundle identifier needs to be unique across Apple's servers. If you get a
   "failed to register bundle identifier" error, change it to something like
   `io.pointto2.pocketwardrobe.melarn` or add a random suffix.

## 4. Set deployment target

In the same target panel → **General** tab → **Minimum Deployments** → set
**iOS 17.0**. (We use `@Observable`, `ContentUnavailableView`, and improved `Grid`
APIs.)

## 5. Plug in your phone + run

1. Connect your iPhone with a cable. First time: unlock it, tap **Trust** on the
   "Trust this computer?" prompt.
2. In Xcode, at the top of the window, click the device/destination dropdown → select
   your iPhone (it should appear with your phone's name).
3. Hit the **▶ Run** button (or Cmd-R).

**First-run dance on your phone** (only once per machine):

1. After install, the app icon appears but tapping it shows "Untrusted Developer".
2. On iPhone: **Settings → General → VPN & Device Management → [your Apple ID] → Trust**.
3. Tap the app icon — it runs.

## 6. Seven-day expiry

Free Apple ID signing expires every 7 days. To renew: plug the phone back into your Mac,
hit Run again in Xcode, done. (Paid dev account → TestFlight removes this limit.)

## What you get on first run

- **Wardrobe tab** — editorial grid of 12 sample garments with match badges, avg-cost
  pills, tap for detail sheet.
- **Diary tab** — April 2026 month view, 11 worn days with full-bleed photos, tap a day
  for detail, tap an empty day to log.
- **Rules tab** — categorized rule cards (Pairings, Occasion, Layering, Avoidances,
  Seasonality) with weight bars, active toggles, detail sheet.
- **Trends tab** and **Planner tab** — placeholder screens ("Coming soon · the web
  mockups are next").

## Fonts

The project uses the system font stack by default (New York serif as a Fraunces stand-in,
SF Pro as Inter, SF Mono as JetBrains Mono). It looks clean immediately.

To ship the real fonts later:

1. Download TTF variable files from https://fonts.google.com/specimen/Fraunces and
   https://fonts.google.com/specimen/Inter and
   https://fonts.google.com/specimen/JetBrains+Mono.
2. Drag them into `Resources/Fonts/` in Xcode (create groups, add to target).
3. Add each filename to the `UIAppFonts` array in `Info.plist` (see
   `Resources/Info-fonts-snippet.plist` for the exact keys).
4. Restart the app — `PWFont` will auto-prefer the custom faces if registered.

## Troubleshooting

- **"No development team selected"** → step 3 above.
- **"Could not launch app"** → trust the developer on your phone (step 5, sub-bullet).
- **Blank screen** → check minimum iOS is 17.0 (step 4).
- **Simulator works, device doesn't** → cable issue or device not unlocked.
- **Images don't load** → sample data pulls from Unsplash; needs wifi. Swap with local
  assets if offline.
