# iOS UI Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the iOS app feel like the same product as the web by bundling the correct fonts and elevating the GarmentCard to match the web card's detail level.

**Architecture:** Three independent changes — model extension (add `isFavourite` to `Garment`), font bundling (download TTFs, register in Xcode + Info.plist), and view updates (GarmentCard + TrendsView cleanup). Font bundling requires one manual Xcode drag-and-drop step; everything else is code.

**Tech Stack:** SwiftUI, Xcode 16, Google Fonts (Fraunces, Inter, JetBrains Mono). All UI components (`TagChip`, `EyebrowLabel`) already exist in `PWComponents.swift`.

---

### Task 1: Add `isFavourite` to Garment model and SampleData

**Files:**
- Modify: `ios/PocketWardrobev5/PocketWardrobev5/Models/Garment.swift`
- Modify: `ios/PocketWardrobev5/PocketWardrobev5/Data/SampleData.swift`

- [ ] **Step 1: Add `isFavourite` to Garment struct**

In `Garment.swift`, add the field after `tags`:

```swift
struct Garment: Identifiable, Hashable {
    let id: UUID
    let name: String
    let brand: String?
    let category: Category
    let colourName: String
    let colourHex: UInt32
    let imageURL: URL
    let costPerWear: Double
    let timesWorn: Int
    let match: MatchKind?
    let season: Season
    let tags: [String]
    let isFavourite: Bool          // ← new
```

- [ ] **Step 2: Update all Garment initialisers in SampleData.swift**

Add `isFavourite:` to every `Garment(...)` call. Mark the double-breasted blazer, soft leather tote, and straight-leg denim as favourites (highest `timesWorn` values — they earn it). All others `false`.

```swift
// totemeBlazer
Garment(
    id: GID.totemeBlazer, name: "Double-breasted blazer", brand: "Totême",
    category: .outerwear, colourName: "Sand", colourHex: 0xC9B893,
    imageURL: URL(string: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=680&q=85")!,
    costPerWear: 4.20, timesWorn: 47, match: .exact, season: .allYear,
    tags: ["workwear", "tonal", "tailored"], isFavourite: true),

// khaiteBlouse
Garment(
    id: GID.khaiteBlouse, name: "Silk crepe blouse", brand: "Khaite",
    category: .top, colourName: "Parchment", colourHex: 0xF5EFE0,
    imageURL: URL(string: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=680&q=85")!,
    costPerWear: 6.80, timesWorn: 22, match: .exact, season: .transitional,
    tags: ["silk", "office"], isFavourite: false),

// acneTrouser
Garment(
    id: GID.acneTrouser, name: "Wide-leg wool trouser", brand: "Acne Studios",
    category: .bottom, colourName: "Charcoal", colourHex: 0x3A3A3A,
    imageURL: URL(string: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=680&q=85")!,
    costPerWear: 3.90, timesWorn: 33, match: .exact, season: .transitional,
    tags: ["wool", "tailored"], isFavourite: false),

// bbPump
Garment(
    id: GID.bbPump, name: "Leather pump", brand: "The Row",
    category: .footwear, colourName: "Oxblood", colourHex: 0x6E2B2B,
    imageURL: URL(string: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=680&q=85")!,
    costPerWear: 12.50, timesWorn: 11, match: .styling, season: .allYear,
    tags: ["leather", "evening-ready"], isFavourite: false),

// leatherTote
Garment(
    id: GID.leatherTote, name: "Soft leather tote", brand: "Hereu",
    category: .bag, colourName: "Cognac", colourHex: 0x8B5A2B,
    imageURL: URL(string: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=680&q=85")!,
    costPerWear: 5.10, timesWorn: 94, match: .exact, season: .allYear,
    tags: ["leather", "everyday"], isFavourite: true),

// lemaireTrench
Garment(
    id: GID.lemaireTrench, name: "Wrap trench coat", brand: "Lemaire",
    category: .outerwear, colourName: "Sand", colourHex: 0xD4C5A0,
    imageURL: URL(string: "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=680&q=85")!,
    costPerWear: 7.25, timesWorn: 38, match: .adjacent, season: .transitional,
    tags: ["outer", "rain"], isFavourite: false),

// sezaneKnit
Garment(
    id: GID.sezaneKnit, name: "Merino crewneck", brand: "Sézane",
    category: .top, colourName: "Cream", colourHex: 0xF3EDE0,
    imageURL: URL(string: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=680&q=85")!,
    costPerWear: 4.60, timesWorn: 29, match: .exact, season: .winter,
    tags: ["knit", "layerable"], isFavourite: false),

// levisDenim
Garment(
    id: GID.levisDenim, name: "Straight-leg raw denim", brand: "Levi's",
    category: .bottom, colourName: "Indigo", colourHex: 0x3E5B7E,
    imageURL: URL(string: "https://images.unsplash.com/photo-1475178626620-a4d074967452?auto=format&fit=crop&w=680&q=85")!,
    costPerWear: 2.15, timesWorn: 112, match: .exact, season: .allYear,
    tags: ["denim", "weekend"], isFavourite: true),

// loeweMule
Garment(
    id: GID.loeweMule, name: "Leather mule", brand: "Loewe",
    category: .footwear, colourName: "Bone", colourHex: 0xE8DFCF,
    imageURL: URL(string: "https://images.unsplash.com/photo-1612902376491-63362d1c6ce6?auto=format&fit=crop&w=680&q=85")!,
    costPerWear: 9.40, timesWorn: 18, match: .styling, season: .summer,
    tags: ["leather", "summer"], isFavourite: false),

// arketTee
Garment(
    id: GID.arketTee, name: "Fine cotton tee", brand: "Arket",
    category: .top, colourName: "Ivory", colourHex: 0xF9F4E8,
    imageURL: URL(string: "https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=680&q=85")!,
    costPerWear: 1.20, timesWorn: 140, match: .exact, season: .allYear,
    tags: ["basic", "layerable"], isFavourite: false),

// ragBoneShirt
Garment(
    id: GID.ragBoneShirt, name: "Oxford shirt", brand: "rag & bone",
    category: .top, colourName: "Sky", colourHex: 0xB4CBDE,
    imageURL: URL(string: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=680&q=85")!,
    costPerWear: 3.05, timesWorn: 44, match: .adjacent, season: .transitional,
    tags: ["shirt", "office"], isFavourite: false),

// cosSlipDress
Garment(
    id: GID.cosSlipDress, name: "Bias slip dress", brand: "COS",
    category: .dress, colourName: "Bronze", colourHex: 0x8C6E3A,
    imageURL: URL(string: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=680&q=85")!,
    costPerWear: 11.70, timesWorn: 8, match: .styling, season: .summer,
    tags: ["evening", "silk"], isFavourite: false),
```

- [ ] **Step 3: Build and confirm no compiler errors**

In Xcode: ⌘B. Expected: build succeeds. If any `Garment(...)` initialisers elsewhere in the project are missing `isFavourite:`, add `isFavourite: false` to them.

- [ ] **Step 4: Commit**

```bash
git add ios/PocketWardrobev5/PocketWardrobev5/Models/Garment.swift \
        ios/PocketWardrobev5/PocketWardrobev5/Data/SampleData.swift
git commit -m "feat(ios): add isFavourite to Garment model and SampleData"
```

---

### Task 2: Download font files

**Files:**
- Create: `ios/PocketWardrobev5/PocketWardrobev5/Resources/Fonts/` (directory + 7 TTF files)

The project already has `Info-fonts-snippet.plist` prepared at `Resources/Info-fonts-snippet.plist` — the filenames there are the exact names expected by `PWFont.swift`.

- [ ] **Step 1: Create the Fonts directory**

```bash
mkdir -p ios/PocketWardrobev5/PocketWardrobev5/Resources/Fonts
```

- [ ] **Step 2: Download Fraunces from Google Fonts**

```bash
cd ios/PocketWardrobev5/PocketWardrobev5/Resources/Fonts
curl -L "https://fonts.google.com/download?family=Fraunces" -o Fraunces.zip
unzip -q Fraunces.zip
```

From the unzipped contents, copy only the static TTFs needed:
```bash
cp "static/Fraunces-Light.ttf" .
cp "static/Fraunces-LightItalic.ttf" .
```

If the zip structure differs, run `find . -name "*.ttf" | grep -i light` to locate the files.

- [ ] **Step 3: Download Inter from Google Fonts**

```bash
curl -L "https://fonts.google.com/download?family=Inter" -o Inter.zip
unzip -q Inter.zip
```

Copy only the weights `PWFont.swift` uses:
```bash
cp "static/Inter-Regular.ttf" .
cp "static/Inter-Medium.ttf" .
cp "static/Inter-SemiBold.ttf" .
cp "static/Inter-Bold.ttf" .
```

- [ ] **Step 4: Download JetBrains Mono from Google Fonts**

```bash
curl -L "https://fonts.google.com/download?family=JetBrains+Mono" -o JetBrainsMono.zip
unzip -q JetBrainsMono.zip
```

Copy:
```bash
cp "static/JetBrainsMono-Regular.ttf" .
```

- [ ] **Step 5: Clean up zip and extracted directories**

```bash
rm -rf *.zip Fraunces Inter "JetBrains Mono" __MACOSX static
```

- [ ] **Step 6: Confirm all 7 files are present**

```bash
ls *.ttf
```

Expected output (order may vary):
```
Fraunces-Light.ttf
Fraunces-LightItalic.ttf
Inter-Bold.ttf
Inter-Medium.ttf
Inter-Regular.ttf
Inter-SemiBold.ttf
JetBrainsMono-Regular.ttf
```

- [ ] **Step 7: Commit the font files**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
git add ios/PocketWardrobev5/PocketWardrobev5/Resources/Fonts/
git commit -m "feat(ios): add Fraunces, Inter, JetBrains Mono font files"
```

---

### Task 3: Register fonts in Xcode project (manual + Info.plist)

**Files:**
- Modify: Xcode project navigator (manual drag-and-drop — cannot be scripted reliably)
- Modify: Xcode Build Settings / Info tab to add `UIAppFonts`

This task has one manual Xcode step. Do it before editing Info.plist.

- [ ] **Step 1: Add font files to the Xcode target (manual)**

1. Open `ios/PocketWardrobev5/PocketWardrobev5.xcodeproj` in Xcode
2. In the Project Navigator, right-click `Resources` → **Add Files to "PocketWardrobev5"**
3. Navigate to `Resources/Fonts/`, select all 7 TTF files
4. Ensure **"Add to targets: PocketWardrobev5"** is ticked
5. Click Add

The files should now appear under Resources/Fonts in the navigator and in the target's **Build Phases → Copy Bundle Resources**.

- [ ] **Step 2: Add UIAppFonts to Info.plist via Xcode**

The snippet is already prepared at `Resources/Info-fonts-snippet.plist`. In Xcode:

1. Select the `PocketWardrobev5` target → **Info** tab
2. Under **Custom iOS Target Properties**, click `+` to add a new key
3. Add key `Fonts provided by application` (UIAppFonts), type Array
4. Add these 7 string items:
   - `Fraunces-Light.ttf`
   - `Fraunces-LightItalic.ttf`
   - `Inter-Regular.ttf`
   - `Inter-Medium.ttf`
   - `Inter-SemiBold.ttf`
   - `Inter-Bold.ttf`
   - `JetBrainsMono-Regular.ttf`

- [ ] **Step 3: Build and verify fonts load**

⌘B to build. Then open `GarmentCard.swift` and check the `#Preview`. The garment name should render in a light-weight old-style serif (Fraunces), not the slab-serif NewYork fallback.

If the preview still shows NewYork, check: (a) the TTF filenames match exactly, (b) all files are in Copy Bundle Resources, (c) UIAppFonts array has no typos.

- [ ] **Step 4: Commit the Info.plist changes**

```bash
git add ios/PocketWardrobev5/PocketWardrobev5.xcodeproj/project.pbxproj
git commit -m "feat(ios): register Fraunces/Inter/JetBrainsMono in Xcode project and Info.plist"
```

---

### Task 4: Update GarmentCard

**Files:**
- Modify: `ios/PocketWardrobev5/PocketWardrobev5/Features/Wardrobe/GarmentCard.swift`

- [ ] **Step 1: Replace GarmentCard body with updated version**

Replace the entire `GarmentCard.swift` with:

```swift
//
//  GarmentCard.swift
//  Pocket Wardrobe — editorial card for a single garment.
//

import SwiftUI

struct GarmentCard: View {
    let garment: Garment

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {

            // Category eyebrow
            EyebrowLabel(text: garment.category.rawValue)

            // Image — 4/5 aspect box, image fills + clips
            Color.clear
                .aspectRatio(4.0/5.0, contentMode: .fit)
                .overlay(
                    AsyncImage(url: garment.imageURL, transaction: .init(animation: .easeIn)) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable()
                                .aspectRatio(contentMode: .fill)
                        case .failure(_), .empty:
                            ZStack {
                                PWColor.mist
                                Image(systemName: "photo")
                                    .foregroundStyle(PWColor.ink20)
                                    .font(.system(size: 22, weight: .light))
                            }
                        @unknown default:
                            PWColor.mist
                        }
                    }
                )
                .clipped()
                .clipShape(RoundedRectangle(cornerRadius: PWRadius.sm))
                .overlay(
                    RoundedRectangle(cornerRadius: PWRadius.sm)
                        .stroke(PWColor.line, lineWidth: 1)
                )

            // Brand · category + name
            VStack(alignment: .leading, spacing: 2) {
                if let brand = garment.brand {
                    Text("\(brand) · \(garment.category.rawValue.lowercased())")
                        .font(PWFont.body(size: 10, weight: .medium))
                        .tracking(10 * 0.14)
                        .textCase(.uppercase)
                        .foregroundStyle(PWColor.ink60)
                } else {
                    Text(garment.category.rawValue.lowercased())
                        .font(PWFont.body(size: 10, weight: .medium))
                        .tracking(10 * 0.14)
                        .textCase(.uppercase)
                        .foregroundStyle(PWColor.ink60)
                }
                Text(garment.name)
                    .font(PWFont.display(size: 18))
                    .foregroundStyle(PWColor.ink)
                    .lineLimit(2, reservesSpace: true)
                    .minimumScaleFactor(0.9)
                    .multilineTextAlignment(.leading)
            }

            // Colour swatch
            HStack(spacing: 6) {
                Circle()
                    .fill(Color(hex: garment.colourHex))
                    .frame(width: 10, height: 10)
                    .overlay(Circle().stroke(PWColor.line, lineWidth: 1))
                Text(garment.colourName)
                    .font(PWFont.body(size: 11))
                    .foregroundStyle(PWColor.ink70)
            }

            // Pill row: cost-per-wear · wears count · favourite
            HStack(spacing: 6) {
                TagChip(
                    text: "AUD \(String(format: "%.2f", garment.costPerWear))/wear",
                    style: .solid
                )
                TagChip(
                    text: "\(garment.timesWorn) wears",
                    style: .plain
                )
                if garment.isFavourite {
                    TagChip(text: "Favourite", style: .plain)
                }
            }
        }
    }
}

#Preview {
    GarmentCard(garment: SampleData.garments[0])
        .padding()
        .background(PWColor.ivory)
}
```

- [ ] **Step 2: Build and check preview**

⌘B, then open the `#Preview` for `GarmentCard`. Verify:
- Category eyebrow appears above the image (e.g. "OUTERWEAR")
- Brand line reads "TOTÊME · outerwear"
- Pill row shows black `[AUD 4.20/wear]` chip, light `[47 wears]` chip, and `[Favourite]` chip (Totême blazer has `isFavourite: true`)
- Colour swatch still appears between name and pills

- [ ] **Step 3: Check a non-favourite card**

In the `#Preview`, change `SampleData.garments[0]` to `SampleData.garments[1]` (Khaite blouse, `isFavourite: false`). Confirm the Favourite chip does not appear.

Restore to `[0]` before committing.

- [ ] **Step 4: Commit**

```bash
git add ios/PocketWardrobev5/PocketWardrobev5/Features/Wardrobe/GarmentCard.swift
git commit -m "feat(ios): elevate GarmentCard to match web detail — category, brand·subcategory, pill row"
```

---

### Task 5: Remove debug border from TrendsView

**Files:**
- Modify: `ios/PocketWardrobev5/PocketWardrobev5/Features/Trends/TrendsView.swift:131`

- [ ] **Step 1: Remove the debug line**

In `TrendsView.swift`, delete line 131:

```swift
            .border(Color.red, width: 2)   // DEBUG: delete me — shows VStack bounds
```

The surrounding context (so you can find it):
```swift
        .background(PWColor.ivory)  // line above
        // ← deleted line was here
        .sheet(item: $selectedSignal) { signal in  // line below
```

- [ ] **Step 2: Build and check TrendsView preview**

⌘B. Open `TrendsView` `#Preview`. Confirm no red border around the scroll content.

- [ ] **Step 3: Commit**

```bash
git add ios/PocketWardrobev5/PocketWardrobev5/Features/Trends/TrendsView.swift
git commit -m "fix(ios): remove debug border from TrendsView"
```
