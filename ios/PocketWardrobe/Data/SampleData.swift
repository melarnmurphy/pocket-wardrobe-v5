//
//  SampleData.swift
//  Pocket Wardrobe — hardcoded seed mirroring the HTML mockups.
//
//  One source of truth for the first-pass UI. When we wire Supabase later, this file
//  becomes the preview fixture.
//

import Foundation

enum SampleData {

    // MARK: - Calendar helpers

    /// Build a `Date` in the European (Amsterdam) calendar used by this app.
    static func date(_ y: Int, _ m: Int, _ d: Int) -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Europe/Amsterdam")!
        cal.firstWeekday = 2  // Monday
        return cal.date(from: DateComponents(year: y, month: m, day: d))!
    }

    static let today = date(2026, 4, 21)       // Tuesday, April 21, 2026

    // MARK: - Fixed IDs so WearEvent.pieceIDs can reference garments deterministically

    private enum GID {
        static let totemeBlazer     = UUID()
        static let khaiteBlouse     = UUID()
        static let acneTrouser      = UUID()
        static let bbPump           = UUID()
        static let leatherTote      = UUID()
        static let lemaireTrench    = UUID()
        static let sezaneKnit       = UUID()
        static let levisDenim       = UUID()
        static let loeweMule        = UUID()
        static let arketTee         = UUID()
        static let ragBoneShirt     = UUID()
        static let cosSlipDress     = UUID()
    }

    // MARK: - Garments

    static let garments: [Garment] = [
        Garment(
            id: GID.totemeBlazer, name: "Double-breasted blazer", brand: "Totême",
            category: .outerwear, colourName: "Sand", colourHex: 0xC9B893,
            imageURL: URL(string: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=680&q=85")!,
            costPerWear: 4.20, timesWorn: 47, match: .exact, season: .allYear,
            tags: ["workwear", "tonal", "tailored"]),
        Garment(
            id: GID.khaiteBlouse, name: "Silk crepe blouse", brand: "Khaite",
            category: .top, colourName: "Parchment", colourHex: 0xF5EFE0,
            imageURL: URL(string: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=680&q=85")!,
            costPerWear: 6.80, timesWorn: 22, match: .exact, season: .transitional,
            tags: ["silk", "office"]),
        Garment(
            id: GID.acneTrouser, name: "Wide-leg wool trouser", brand: "Acne Studios",
            category: .bottom, colourName: "Charcoal", colourHex: 0x3A3A3A,
            imageURL: URL(string: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=680&q=85")!,
            costPerWear: 3.90, timesWorn: 33, match: .exact, season: .transitional,
            tags: ["wool", "tailored"]),
        Garment(
            id: GID.bbPump, name: "Leather pump", brand: "The Row",
            category: .footwear, colourName: "Oxblood", colourHex: 0x6E2B2B,
            imageURL: URL(string: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=680&q=85")!,
            costPerWear: 12.50, timesWorn: 11, match: .styling, season: .allYear,
            tags: ["leather", "evening-ready"]),
        Garment(
            id: GID.leatherTote, name: "Soft leather tote", brand: "Hereu",
            category: .bag, colourName: "Cognac", colourHex: 0x8B5A2B,
            imageURL: URL(string: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=680&q=85")!,
            costPerWear: 5.10, timesWorn: 94, match: .exact, season: .allYear,
            tags: ["leather", "everyday"]),
        Garment(
            id: GID.lemaireTrench, name: "Wrap trench coat", brand: "Lemaire",
            category: .outerwear, colourName: "Sand", colourHex: 0xD4C5A0,
            imageURL: URL(string: "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=680&q=85")!,
            costPerWear: 7.25, timesWorn: 38, match: .adjacent, season: .transitional,
            tags: ["outer", "rain"]),
        Garment(
            id: GID.sezaneKnit, name: "Merino crewneck", brand: "Sézane",
            category: .top, colourName: "Cream", colourHex: 0xF3EDE0,
            imageURL: URL(string: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=680&q=85")!,
            costPerWear: 4.60, timesWorn: 29, match: .exact, season: .winter,
            tags: ["knit", "layerable"]),
        Garment(
            id: GID.levisDenim, name: "Straight-leg raw denim", brand: "Levi's",
            category: .bottom, colourName: "Indigo", colourHex: 0x3E5B7E,
            imageURL: URL(string: "https://images.unsplash.com/photo-1475178626620-a4d074967452?auto=format&fit=crop&w=680&q=85")!,
            costPerWear: 2.15, timesWorn: 112, match: .exact, season: .allYear,
            tags: ["denim", "weekend"]),
        Garment(
            id: GID.loeweMule, name: "Leather mule", brand: "Loewe",
            category: .footwear, colourName: "Bone", colourHex: 0xE8DFCF,
            imageURL: URL(string: "https://images.unsplash.com/photo-1612902376491-63362d1c6ce6?auto=format&fit=crop&w=680&q=85")!,
            costPerWear: 9.40, timesWorn: 18, match: .styling, season: .summer,
            tags: ["leather", "summer"]),
        Garment(
            id: GID.arketTee, name: "Fine cotton tee", brand: "Arket",
            category: .top, colourName: "Ivory", colourHex: 0xF9F4E8,
            imageURL: URL(string: "https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=680&q=85")!,
            costPerWear: 1.20, timesWorn: 140, match: .exact, season: .allYear,
            tags: ["basic", "layerable"]),
        Garment(
            id: GID.ragBoneShirt, name: "Oxford shirt", brand: "rag & bone",
            category: .top, colourName: "Sky", colourHex: 0xB4CBDE,
            imageURL: URL(string: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=680&q=85")!,
            costPerWear: 3.05, timesWorn: 44, match: .adjacent, season: .transitional,
            tags: ["shirt", "office"]),
        Garment(
            id: GID.cosSlipDress, name: "Bias slip dress", brand: "COS",
            category: .dress, colourName: "Bronze", colourHex: 0x8C6E3A,
            imageURL: URL(string: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=680&q=85")!,
            costPerWear: 11.70, timesWorn: 8, match: .styling, season: .summer,
            tags: ["evening", "silk"]),
    ]

    // MARK: - Wear events (diary)

    static let wearEvents: [WearEvent] = {
        func e(_ day: Int, title: String, occasion: String, url: String,
               pieces: [UUID], note: String?, fav: Bool,
               weatherC: Int, weatherSummary: String,
               source: WearEvent.Source) -> WearEvent
        {
            WearEvent(
                id: UUID(),
                date: date(2026, 4, day),
                title: title, occasion: occasion,
                photoURL: URL(string: url)!,
                pieceIDs: pieces,
                note: note, isFavourite: fav,
                weatherC: weatherC, weatherSummary: weatherSummary,
                source: source
            )
        }
        return [
            e(1, title: "Soft opener",            occasion: "Weekend · brunch",
              url: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=85",
              pieces: [GID.arketTee, GID.levisDenim, GID.leatherTote],
              note: "Easy, warm enough.", fav: false, weatherC: 12, weatherSummary: "overcast",
              source: .pickFromCloset),
            e(3, title: "Studio day",             occasion: "Workwear · studio",
              url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=85",
              pieces: [GID.totemeBlazer, GID.khaiteBlouse, GID.acneTrouser, GID.bbPump],
              note: nil, fav: true, weatherC: 14, weatherSummary: "cloudy",
              source: .planner),
            e(5, title: "Sunday slowness",        occasion: "At home",
              url: "https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?auto=format&fit=crop&w=800&q=85",
              pieces: [GID.sezaneKnit, GID.levisDenim],
              note: nil, fav: false, weatherC: 11, weatherSummary: "rain",
              source: .manualPhoto),
            e(7, title: "Morning light",          occasion: "Meetings",
              url: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=85",
              pieces: [GID.ragBoneShirt, GID.acneTrouser, GID.loeweMule],
              note: "Too warm by afternoon.", fav: false, weatherC: 17, weatherSummary: "sunny",
              source: .planner),
            e(9, title: "Trench weather",         occasion: "Errands",
              url: "https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=800&q=85",
              pieces: [GID.lemaireTrench, GID.sezaneKnit, GID.levisDenim, GID.loeweMule],
              note: "This coat is doing real work.", fav: true, weatherC: 13, weatherSummary: "light rain",
              source: .pickFromCloset),
            e(11, title: "Dinner",                 occasion: "Dinner · friends",
              url: "https://images.unsplash.com/photo-1509319117193-57bab727e09d?auto=format&fit=crop&w=800&q=85",
              pieces: [GID.cosSlipDress, GID.bbPump, GID.leatherTote],
              note: "The slip, finally worn.", fav: true, weatherC: 15, weatherSummary: "clear night",
              source: .planner),
            e(13, title: "Half day",              occasion: "Workwear · studio",
              url: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=800&q=85",
              pieces: [GID.sezaneKnit, GID.acneTrouser, GID.loeweMule, GID.leatherTote],
              note: nil, fav: false, weatherC: 14, weatherSummary: "cloudy",
              source: .pickFromCloset),
            e(14, title: "Workwear, the tonal one", occasion: "Workwear · studio",
              url: "https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?auto=format&fit=crop&w=800&q=85",
              pieces: [GID.totemeBlazer, GID.khaiteBlouse, GID.acneTrouser, GID.bbPump, GID.leatherTote],
              note: "Worked. The blouse — that colour under the blazer — finally clicked. Felt put together without fussing.",
              fav: true, weatherC: 14, weatherSummary: "cloudy, light wind",
              source: .planner),
            e(16, title: "Walking meeting",       occasion: "Outside · casual",
              url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=85",
              pieces: [GID.lemaireTrench, GID.ragBoneShirt, GID.levisDenim, GID.loeweMule],
              note: nil, fav: false, weatherC: 16, weatherSummary: "sunny breaks",
              source: .planner),
            e(18, title: "Soft Saturday",         occasion: "Weekend · errands",
              url: "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?auto=format&fit=crop&w=800&q=85",
              pieces: [GID.arketTee, GID.acneTrouser, GID.loeweMule, GID.leatherTote],
              note: nil, fav: false, weatherC: 18, weatherSummary: "warm",
              source: .manualPhoto),
            e(20, title: "Monday again",          occasion: "Workwear · studio",
              url: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=85",
              pieces: [GID.ragBoneShirt, GID.acneTrouser, GID.bbPump],
              note: nil, fav: false, weatherC: 15, weatherSummary: "cloudy",
              source: .planner),
        ]
    }()

    // MARK: - Style rules

    static let rules: [StyleRule] = [
        // Pairings
        StyleRule(id: UUID(),
            subject: "Beige", predicate: .pairsWith, object: "Navy",
            weight: 0.92, scope: .canon, isActive: true,
            usage: .init(firedInOutfits: 14, blockedSuggestions: 0),
            rationale: "Warm pigment + cool depth. The foundation pairing of Parisian workwear and quiet-luxury tailoring.",
            viz: .swatchPair(subject: 0xC9B893, object: 0x1E2A44)),
        StyleRule(id: UUID(),
            subject: "Cream", predicate: .pairsWith, object: "Oxblood",
            weight: 0.78, scope: .yours, isActive: true,
            usage: .init(firedInOutfits: 6, blockedSuggestions: 0),
            rationale: "Your own rule. The warm contrast reads sophisticated without trying.",
            viz: .swatchPair(subject: 0xF3EDE0, object: 0x6E2B2B)),
        StyleRule(id: UUID(),
            subject: "Olive", predicate: .pairsWith, object: "Soft cream",
            weight: 0.88, scope: .canon, isActive: true,
            usage: .init(firedInOutfits: 9, blockedSuggestions: 0),
            rationale: "Earthy + airy. Canon military-adjacent pairing that softens in cream.",
            viz: .swatchPair(subject: 0x3E4A34, object: 0xF5EFE0)),
        StyleRule(id: UUID(),
            subject: "Heavy wool", predicate: .pairsWith, object: "Silk",
            weight: 0.81, scope: .canon, isActive: true,
            usage: .init(firedInOutfits: 7, blockedSuggestions: 0),
            rationale: "Material tension — rough + smooth — reads intentional.",
            viz: .glyph(symbol: "circle.grid.cross")),

        // Occasion
        StyleRule(id: UUID(),
            subject: "Blazer + trouser + shirt", predicate: .appropriateFor, object: "Workwear",
            weight: 0.95, scope: .canon, isActive: true,
            usage: .init(firedInOutfits: 22, blockedSuggestions: 0),
            rationale: "The three-piece silhouette. Legible as put-together in any context.",
            viz: .glyph(symbol: "briefcase")),
        StyleRule(id: UUID(),
            subject: "Slip dress + low heel", predicate: .appropriateFor, object: "Dinner",
            weight: 0.82, scope: .yours, isActive: true,
            usage: .init(firedInOutfits: 5, blockedSuggestions: 0),
            rationale: "Soft formal without overdressing.",
            viz: .glyph(symbol: "wineglass")),
        StyleRule(id: UUID(),
            subject: "Trench + fine knit", predicate: .appropriateFor, object: "Smart-casual",
            weight: 0.86, scope: .canon, isActive: true,
            usage: .init(firedInOutfits: 12, blockedSuggestions: 0),
            rationale: "Structure through the outer layer, softness underneath.",
            viz: .glyph(symbol: "cloud.rain")),

        // Layering
        StyleRule(id: UUID(),
            subject: "Fine knit", predicate: .layerableWith, object: "Structured coat",
            weight: 0.90, scope: .canon, isActive: true,
            usage: .init(firedInOutfits: 19, blockedSuggestions: 0),
            rationale: "Knit gives the coat something to contain; coat gives the knit a frame.",
            viz: .iconPair(subject: "tshirt", connector: "under", object: "rectangle.stack")),
        StyleRule(id: UUID(),
            subject: "Oxford shirt", predicate: .layerableWith, object: "Crewneck",
            weight: 0.72, scope: .canon, isActive: true,
            usage: .init(firedInOutfits: 6, blockedSuggestions: 0),
            rationale: "Collar peeks. Preppy done quietly.",
            viz: .iconPair(subject: "shirt", connector: "under", object: "tshirt")),
        StyleRule(id: UUID(),
            subject: "Fine cotton tee", predicate: .layerableWith, object: "Unstructured blazer",
            weight: 0.76, scope: .yours, isActive: true,
            usage: .init(firedInOutfits: 9, blockedSuggestions: 0),
            rationale: "Low-effort chic.",
            viz: .iconPair(subject: "tshirt", connector: "under", object: "briefcase")),

        // Avoid
        StyleRule(id: UUID(),
            subject: "Open sandals", predicate: .avoidWith, object: "Cold rain",
            weight: 0.97, scope: .canon, isActive: true,
            usage: .init(firedInOutfits: 0, blockedSuggestions: 3),
            rationale: "Don't. Shoes must match the weather.",
            viz: .iconPair(subject: "shoeprints.fill", connector: "× with", object: "cloud.rain.fill")),
        StyleRule(id: UUID(),
            subject: "Chunky hiking boot", predicate: .avoidWith, object: "Silk slip dress",
            weight: 0.84, scope: .yours, isActive: true,
            usage: .init(firedInOutfits: 0, blockedSuggestions: 2),
            rationale: "Weight clash. The boot shouts over the dress.",
            viz: .iconPair(subject: "figure.walk", connector: "× with", object: "sparkles")),
        StyleRule(id: UUID(),
            subject: "Brown leather shoe", predicate: .avoidWith, object: "Black trouser",
            weight: 0.52, scope: .canon, isActive: true,
            usage: .init(firedInOutfits: 0, blockedSuggestions: 1),
            rationale: "Traditional rule — relax at will.",
            viz: .swatchPair(subject: 0x5C3A1E, object: 0x0B0B0B)),
        StyleRule(id: UUID(),
            subject: "Sequins", predicate: .avoidWith, object: "Daytime",
            weight: 0.60, scope: .yours, isActive: false,
            usage: .init(firedInOutfits: 0, blockedSuggestions: 0),
            rationale: "You wear them how you want.",
            viz: .glyph(symbol: "sparkle")),

        // Seasonality
        StyleRule(id: UUID(),
            subject: "Heavy wool", predicate: .seasonality, object: "Winter",
            weight: 0.98, scope: .canon, isActive: true,
            usage: .init(firedInOutfits: 31, blockedSuggestions: 0),
            rationale: "Below 8°. Fires Nov–Feb.",
            viz: .glyph(symbol: "snowflake")),
        StyleRule(id: UUID(),
            subject: "Linen", predicate: .seasonality, object: "Summer",
            weight: 0.94, scope: .canon, isActive: true,
            usage: .init(firedInOutfits: 18, blockedSuggestions: 0),
            rationale: "Above 22°. Fires Jun–Aug.",
            viz: .glyph(symbol: "sun.max")),
        StyleRule(id: UUID(),
            subject: "Trench coat", predicate: .seasonality, object: "Transitional weather",
            weight: 0.89, scope: .yours, isActive: true,
            usage: .init(firedInOutfits: 14, blockedSuggestions: 0),
            rationale: "10–16°. Fires Mar–May, Sep–Oct.",
            viz: .glyph(symbol: "cloud.sun")),
        StyleRule(id: UUID(),
            subject: "Suede", predicate: .seasonality, object: "Dry weather",
            weight: 0.85, scope: .canon, isActive: true,
            usage: .init(firedInOutfits: 7, blockedSuggestions: 0),
            rationale: "Zero rain forecast.",
            viz: .glyph(symbol: "wind")),
    ]

    // MARK: - Lookups

    static func garment(_ id: UUID) -> Garment? {
        garments.first { $0.id == id }
    }

    // MARK: - Lookbook

    static let lookbookBoards: [LookbookBoard] = [
        LookbookBoard(
            id: UUID(), name: "Summer in Italy", count: 42, isFeatured: true,
            heroURL: URL(string: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=85"),
            ownedCount: 14, missingCount: 2),
        LookbookBoard(id: UUID(), name: "Workwear refined", count: 31, isFeatured: false,
                      heroURL: nil, ownedCount: 22, missingCount: 1),
        LookbookBoard(id: UUID(), name: "Evening & events", count: 19, isFeatured: false,
                      heroURL: nil, ownedCount: 9, missingCount: 3),
        LookbookBoard(id: UUID(), name: "Layering studies", count: 27, isFeatured: false,
                      heroURL: nil, ownedCount: 18, missingCount: 2),
        LookbookBoard(id: UUID(), name: "Missing pieces", count: 12, isFeatured: false,
                      heroURL: nil, ownedCount: 0, missingCount: 12),
        LookbookBoard(id: UUID(), name: "Wishlist", count: 23, isFeatured: false,
                      heroURL: nil, ownedCount: 0, missingCount: 0),
    ]

    static let lookbookEntries: [LookbookEntry] = [
        LookbookEntry(id: UUID(), title: "Relaxed tailoring",
            imageURL: URL(string: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=85")!,
            board: "Summer in Italy", tags: ["Tonal", "Tailored"],
            sourceURL: "pinterest.com/pin/42918",
            ownedPieceIDs: [GID.totemeBlazer, GID.acneTrouser, GID.bbPump],
            missingPiece: nil, matchKind: .exact,
            note: "The anchor piece — tonal cream on cream."),
        LookbookEntry(id: UUID(), title: "Ivory silk, bare",
            imageURL: URL(string: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=85")!,
            board: "Summer in Italy", tags: ["Silk", "Minimal"],
            sourceURL: "vogue.com/editorial/may-2026",
            ownedPieceIDs: [GID.khaiteBlouse],
            missingPiece: nil, matchKind: .styling, note: nil),
        LookbookEntry(id: UUID(), title: "Three-tone layering",
            imageURL: URL(string: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=85")!,
            board: "Layering studies", tags: ["Workwear", "Tonal"],
            sourceURL: "pinterest.com/pin/19203",
            ownedPieceIDs: [GID.totemeBlazer, GID.sezaneKnit, GID.acneTrouser],
            missingPiece: nil, matchKind: .exact, note: nil),
        LookbookEntry(id: UUID(), title: "Olive & ecru",
            imageURL: URL(string: "https://images.unsplash.com/photo-1605518216938-7c31b7b14ad0?auto=format&fit=crop&w=800&q=85")!,
            board: "Summer in Italy", tags: ["Earth", "Green"],
            sourceURL: "pinterest.com/pin/88212",
            ownedPieceIDs: [GID.lemaireTrench],
            missingPiece: .init(label: "Olive cotton midi skirt", reason: "No match in your wardrobe"),
            matchKind: .missing, note: "Flagged for wishlist."),
        LookbookEntry(id: UUID(), title: "White cotton",
            imageURL: URL(string: "https://images.unsplash.com/photo-1588099768523-f4e6a5679d88?auto=format&fit=crop&w=800&q=85")!,
            board: "Summer in Italy", tags: ["Cotton", "Light"],
            sourceURL: "editorial.dezeen/2026-04",
            ownedPieceIDs: [GID.arketTee, GID.levisDenim],
            missingPiece: nil, matchKind: .adjacent, note: nil),
        LookbookEntry(id: UUID(), title: "Black evening",
            imageURL: URL(string: "https://images.unsplash.com/photo-1551232864-3f0890e580d9?auto=format&fit=crop&w=800&q=85")!,
            board: "Evening & events", tags: ["Slip", "Evening"],
            sourceURL: "pinterest.com/pin/55501",
            ownedPieceIDs: [GID.cosSlipDress, GID.bbPump],
            missingPiece: nil, matchKind: .styling, note: nil),
        LookbookEntry(id: UUID(), title: "Travelling light",
            imageURL: URL(string: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=85")!,
            board: "Workwear refined", tags: ["Travel", "Tonal"],
            sourceURL: "pinterest.com/pin/11198",
            ownedPieceIDs: [GID.acneTrouser, GID.ragBoneShirt, GID.leatherTote],
            missingPiece: nil, matchKind: .exact, note: nil),
        LookbookEntry(id: UUID(), title: "Knitwear & camel",
            imageURL: URL(string: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=800&q=85")!,
            board: "Layering studies", tags: ["Knit", "Camel"],
            sourceURL: "pinterest.com/pin/61023",
            ownedPieceIDs: [GID.sezaneKnit, GID.lemaireTrench],
            missingPiece: nil, matchKind: .adjacent, note: nil),
        LookbookEntry(id: UUID(), title: "Trench belted",
            imageURL: URL(string: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=85")!,
            board: "Workwear refined", tags: ["Outer", "Classic"],
            sourceURL: "pinterest.com/pin/30007",
            ownedPieceIDs: [GID.lemaireTrench, GID.acneTrouser],
            missingPiece: nil, matchKind: .exact, note: nil),
        LookbookEntry(id: UUID(), title: "Loose wool trouser",
            imageURL: URL(string: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=85")!,
            board: "Layering studies", tags: ["Wool", "Relaxed"],
            sourceURL: "pinterest.com/pin/92310",
            ownedPieceIDs: [GID.acneTrouser, GID.arketTee],
            missingPiece: nil, matchKind: .exact, note: nil),
        LookbookEntry(id: UUID(), title: "Quiet minimalism",
            imageURL: URL(string: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=800&q=85")!,
            board: "Workwear refined", tags: ["Minimal", "Tonal"],
            sourceURL: "editorial.the-gentlewoman/ss26",
            ownedPieceIDs: [GID.sezaneKnit, GID.acneTrouser, GID.loeweMule],
            missingPiece: nil, matchKind: .exact, note: nil),
        LookbookEntry(id: UUID(), title: "Café morning",
            imageURL: URL(string: "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?auto=format&fit=crop&w=800&q=85")!,
            board: "Summer in Italy", tags: ["Casual", "Light"],
            sourceURL: "pinterest.com/pin/47709",
            ownedPieceIDs: [GID.arketTee, GID.levisDenim, GID.loeweMule],
            missingPiece: nil, matchKind: .adjacent, note: nil),
    ]

    // MARK: - Trends

    static let trendSignals: [TrendSignal] = [
        TrendSignal(
            id: UUID(), category: .colour, title: "Soft white neutrals",
            summary: "Warm ivories and chalky off-whites replacing cool crisp whites across S/S collections.",
            detail: "Warm ivory, chalk, and bone replacing cooler crisp whites across S/S ready-to-wear, three major European runway shows, and two notable brand releases. Reads best in linen and cotton against muted companions (olive, camel, stone).",
            swatches: [0xD6C8AF, 0xEADFC8, 0xF4EEDD],
            sourcesCount: 9, sourceKinds: ["Publications", "Runway"],
            confidence: .high, matchKind: .exact, matchCount: 11,
            matchedPieceIDs: [GID.totemeBlazer, GID.arketTee, GID.khaiteBlouse, GID.sezaneKnit, GID.levisDenim],
            canonicalPalette: [
                .init(hex: 0xF4EEDD, name: "Ivory"),
                .init(hex: 0xEADFC8, name: "Bone"),
                .init(hex: 0xD6C8AF, name: "Sand"),
                .init(hex: 0xC2B89E, name: "Clay")
            ],
            reasons: [
                "Maps to business casual & minimal wardrobes. The palette aligns with your dominant colour families (ivory, sand, umber).",
                "Styling unlock. Pairs your Totême blazer with the Acne pleated taupe trouser for 4 new outfits this week.",
                "Rising, not peaking. Signal appears in 9 sources this cycle, up from 3 last cycle."
            ],
            isSignalOfWeek: true),
        TrendSignal(
            id: UUID(), category: .colour, title: "Deep olive, grounded green",
            summary: "A movement toward muted, earthy greens in tailoring and outerwear.",
            detail: "Muted, earthy greens — olive, sage, moss — moving into tailoring and outerwear. Replaces the bright kelly greens of earlier cycles.",
            swatches: [0x3E4A34, 0x6B705C],
            sourcesCount: 7, sourceKinds: ["Runway", "Brand releases"],
            confidence: .high, matchKind: .adjacent, matchCount: 2,
            matchedPieceIDs: [GID.lemaireTrench],
            canonicalPalette: [
                .init(hex: 0x3E4A34, name: "Deep olive"),
                .init(hex: 0x6B705C, name: "Sage")
            ],
            reasons: [
                "Your Lemaire trench sits close on the colour wheel — two outfits become possible.",
                "Pairs natively with cream and ivory, which is your strongest colour family."
            ],
            isSignalOfWeek: false),
        TrendSignal(
            id: UUID(), category: .garment, title: "Relaxed tailoring",
            summary: "Dropped shoulders, looser silhouettes, longer break. Replaces mid-2020s sharp tailoring.",
            detail: "Softer shoulder lines, looser trouser cuts, gentler breaks. A refusal of the sharp-shoulder tailoring of 2023–2024.",
            swatches: [0xAD9E83, 0xD6C8AF],
            sourcesCount: 11, sourceKinds: ["Publications", "Runway"],
            confidence: .high, matchKind: .exact, matchCount: 3,
            matchedPieceIDs: [GID.totemeBlazer, GID.acneTrouser, GID.ragBoneShirt],
            canonicalPalette: [
                .init(hex: 0xAD9E83, name: "Umber"),
                .init(hex: 0xD6C8AF, name: "Sand")
            ],
            reasons: [
                "Your Totême blazer and Acne trouser already sit in this register.",
                "Styling unlock: soften shoulder with an untucked shirt."
            ],
            isSignalOfWeek: false),
        TrendSignal(
            id: UUID(), category: .material, title: "Heavyweight linen",
            summary: "Crumpled, textured linens surfacing in resort and early-summer drops.",
            detail: "Dense, crumpled linens surfacing in resort and S/S drops. Reads as the serious-summer alternative to polished cottons.",
            swatches: [0xEADFC8, 0xD6C8AF, 0xFFFFFF],
            sourcesCount: 6, sourceKinds: ["Runway", "Press releases"],
            confidence: .medium, matchKind: .styling, matchCount: 0,
            matchedPieceIDs: [],
            canonicalPalette: [.init(hex: 0xEADFC8, name: "Bone")],
            reasons: ["No direct matches but sits inside your summer palette."],
            isSignalOfWeek: false),
        TrendSignal(
            id: UUID(), category: .silhouette, title: "Drop-waist, low-slung",
            summary: "Returning 1920s reference mixed with modern oversizing. Narrow in uptake.",
            detail: "A niche 1920s reference returning through a handful of shows. Early days — narrow in adoption but persistent.",
            swatches: [0x1E2A3A],
            sourcesCount: 4, sourceKinds: ["Runway only"],
            confidence: .low, matchKind: .missing, matchCount: 0,
            matchedPieceIDs: [],
            canonicalPalette: [],
            reasons: ["No piece in your wardrobe sits here yet."],
            isSignalOfWeek: false),
        TrendSignal(
            id: UUID(), category: .colour, title: "Oxblood & burgundy return",
            summary: "Deep reds in leather goods, outerwear, and evening. Building steadily.",
            detail: "Deep, restrained reds returning in leather goods, outerwear and evening. Not cherry — the cooler, older burgundy.",
            swatches: [0x6E2B2B, 0x7A3E3E],
            sourcesCount: 8, sourceKinds: ["Publications", "Brand releases"],
            confidence: .medium, matchKind: .adjacent, matchCount: 1,
            matchedPieceIDs: [GID.bbPump],
            canonicalPalette: [
                .init(hex: 0x6E2B2B, name: "Oxblood"),
                .init(hex: 0x7A3E3E, name: "Burgundy")
            ],
            reasons: ["Your oxblood pump is the only entry — but it's a strong one."],
            isSignalOfWeek: false),
    ]

    static let unmatchedSignals: [UnmatchedSignal] = [
        UnmatchedSignal(id: UUID(), category: .pattern, title: "Faded tonal stripe", sourcesCount: 4, confidence: .low),
        UnmatchedSignal(id: UUID(), category: .silhouette, title: "Utility workwear", sourcesCount: 5, confidence: .medium),
        UnmatchedSignal(id: UUID(), category: .aesthetic, title: "Quiet luxury, cont'd", sourcesCount: 12, confidence: .high),
        UnmatchedSignal(id: UUID(), category: .garment, title: "Buttery leather bomber", sourcesCount: 6, confidence: .medium),
    ]

    // MARK: - Planner

    static let weekPlan: [DayPlan] = [
        DayPlan(date: date(2026, 4, 20), weekday: "Mon", dayNumber: 20,
                weatherC: 17, weatherSummary: "clear", weatherSymbol: "sun.max",
                occasion: "Workwear", isPlanned: true),
        DayPlan(date: date(2026, 4, 21), weekday: "Tue", dayNumber: 21,
                weatherC: 14, weatherSummary: "cloudy", weatherSymbol: "cloud",
                occasion: "Workwear", isPlanned: true),
        DayPlan(date: date(2026, 4, 22), weekday: "Wed", dayNumber: 22,
                weatherC: 12, weatherSummary: "rain", weatherSymbol: "cloud.rain",
                occasion: "Client lunch", isPlanned: true),
        DayPlan(date: date(2026, 4, 23), weekday: "Thu", dayNumber: 23,
                weatherC: 15, weatherSummary: "cloudy", weatherSymbol: "cloud",
                occasion: "Workwear", isPlanned: true),
        DayPlan(date: date(2026, 4, 24), weekday: "Fri", dayNumber: 24,
                weatherC: 18, weatherSummary: "clear", weatherSymbol: "sun.max",
                occasion: "Evening", isPlanned: true),
        DayPlan(date: date(2026, 4, 25), weekday: "Sat", dayNumber: 25,
                weatherC: 19, weatherSummary: "clear", weatherSymbol: "sun.max",
                occasion: "Unplanned", isPlanned: false),
        DayPlan(date: date(2026, 4, 26), weekday: "Sun", dayNumber: 26,
                weatherC: 16, weatherSummary: "cloudy", weatherSymbol: "cloud",
                occasion: "Unplanned", isPlanned: false),
    ]

    /// Tuesday's three variants for the variant tabs.
    static let tuesdayOutfits: [Outfit] = [
        Outfit(
            id: UUID(), date: date(2026, 4, 21), variant: .safe,
            title: "Beige, taupe, a quiet ivory blouse.",
            occasion: "Workwear · studio",
            pieces: [
                .init(id: GID.totemeBlazer, role: .anchor, isAnchor: true),
                .init(id: GID.khaiteBlouse, role: .top, isAnchor: false),
                .init(id: GID.acneTrouser, role: .bottom, isAnchor: false),
                .init(id: GID.bbPump, role: .shoes, isAnchor: false),
                .init(id: GID.leatherTote, role: .bag, isAnchor: false),
            ],
            signalsMatched: 2,
            reasons: [
                .init(icon: "circle.grid.cross", headline: "Tonal palette — bone, sand, umber.",
                      body: "Three close LCH distances create a coherent, low-contrast, daytime-appropriate look."),
                .init(icon: "cloud", headline: "14° and cloudy.",
                      body: "Wool blazer gives light warmth; silk blouse keeps the torso breathable under it."),
                .init(icon: "briefcase", headline: "Workwear appropriate.",
                      body: "Closed-toe leather, tailored shoulder, neutral palette. Reads professional without being stiff."),
                .init(icon: "chart.line.uptrend.xyaxis", headline: "Lifts 3 underworn pieces.",
                      body: "The Acne taupe trouser, Khaite ivory blouse, and oxblood pump gain useful rotation."),
            ],
            weather: .init(celsius: 14, summary: "Partly cloudy, still morning, breeze from the east. Light jacket territory.",
                           low: 11, high: 17, rainProbability: 10, symbol: "cloud")),
        Outfit(
            id: UUID(), date: date(2026, 4, 21), variant: .elevated,
            title: "Trench over silk, the oxblood pump.",
            occasion: "Workwear · studio",
            pieces: [
                .init(id: GID.lemaireTrench, role: .outer, isAnchor: true),
                .init(id: GID.khaiteBlouse, role: .top, isAnchor: false),
                .init(id: GID.acneTrouser, role: .bottom, isAnchor: false),
                .init(id: GID.bbPump, role: .shoes, isAnchor: false),
                .init(id: GID.leatherTote, role: .bag, isAnchor: false),
            ],
            signalsMatched: 3,
            reasons: [
                .init(icon: "sparkles", headline: "Softer silhouette.",
                      body: "Trench gives movement the blazer can't. Same base, more weather."),
                .init(icon: "cloud.sun", headline: "Transitional weather.",
                      body: "Coat handles 11–17° with an open throat."),
            ],
            weather: .init(celsius: 14, summary: "Partly cloudy, light breeze.",
                           low: 11, high: 17, rainProbability: 10, symbol: "cloud")),
        Outfit(
            id: UUID(), date: date(2026, 4, 21), variant: .trend,
            title: "Olive trench, knit, denim.",
            occasion: "Workwear · studio",
            pieces: [
                .init(id: GID.lemaireTrench, role: .outer, isAnchor: true),
                .init(id: GID.sezaneKnit, role: .top, isAnchor: false),
                .init(id: GID.levisDenim, role: .bottom, isAnchor: false),
                .init(id: GID.loeweMule, role: .shoes, isAnchor: false),
                .init(id: GID.leatherTote, role: .bag, isAnchor: false),
            ],
            signalsMatched: 4,
            reasons: [
                .init(icon: "flame", headline: "Matches 4 of this week's signals.",
                      body: "Deep olive, soft white neutrals, relaxed tailoring, and buttery leather."),
                .init(icon: "exclamationmark.circle", headline: "Less conservative.",
                      body: "Denim to studio — your office tolerates this three days in five."),
            ],
            weather: .init(celsius: 14, summary: "Partly cloudy, light breeze.",
                           low: 11, high: 17, rainProbability: 10, symbol: "cloud")),
    ]

    static let alternatives: [OutfitAlternative] = [
        OutfitAlternative(
            title: "Knit & denim",
            caption: "Softer, more casual · 4 pieces",
            thumbnailURLs: [
                URL(string: "https://images.unsplash.com/photo-1588099768523-f4e6a5679d88?auto=format&fit=crop&w=200&q=70")!,
                URL(string: "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=200&q=70")!,
                URL(string: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=200&q=70")!,
                URL(string: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=200&q=70")!,
            ]),
        OutfitAlternative(
            title: "Trench & silk",
            caption: "Sharper silhouette · 4 pieces",
            thumbnailURLs: [
                URL(string: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=200&q=70")!,
                URL(string: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=200&q=70")!,
                URL(string: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=200&q=70")!,
                URL(string: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=200&q=70")!,
            ]),
        OutfitAlternative(
            title: "Olive dress, knit",
            caption: "Trend-forward · 4 pieces",
            thumbnailURLs: [
                URL(string: "https://images.unsplash.com/photo-1605518216938-7c31b7b14ad0?auto=format&fit=crop&w=200&q=70")!,
                URL(string: "https://images.unsplash.com/photo-1551232864-3f0890e580d9?auto=format&fit=crop&w=200&q=70")!,
                URL(string: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=200&q=70")!,
                URL(string: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=200&q=70")!,
            ]),
    ]

    static let savedOutfits: [SavedOutfit] = [
        SavedOutfit(id: UUID(), kind: "Workwear", title: "The tonal blazer",
                    timesWorn: 7, lastWorn: date(2026, 4, 14),
                    pieceIDs: [GID.totemeBlazer, GID.khaiteBlouse, GID.acneTrouser, GID.bbPump]),
        SavedOutfit(id: UUID(), kind: "Evening", title: "Black slip, trench",
                    timesWorn: 3, lastWorn: date(2026, 3, 30),
                    pieceIDs: [GID.cosSlipDress, GID.lemaireTrench, GID.bbPump, GID.leatherTote]),
        SavedOutfit(id: UUID(), kind: "Weekend", title: "Knit & denim",
                    timesWorn: 12, lastWorn: date(2026, 4, 18),
                    pieceIDs: [GID.sezaneKnit, GID.levisDenim, GID.loeweMule, GID.leatherTote]),
        SavedOutfit(id: UUID(), kind: "Travel", title: "Olive midi, cropped knit",
                    timesWorn: 2, lastWorn: date(2026, 3, 22),
                    pieceIDs: [GID.lemaireTrench, GID.cosSlipDress, GID.loeweMule, GID.leatherTote]),
    ]
}
