//
//  PWColor.swift
//  Pocket Wardrobe — editorial palette
//
//  Mirrors `design/styles.css` :root tokens. Cool ivory surfaces, editorial black ink,
//  oxblood/moss/gold reserved for accents only.
//

import SwiftUI

enum PWColor {
    // Surfaces
    static let ivory     = Color(hex: 0xFAFAF6)  // page background
    static let paper     = Color(hex: 0xFFFFFF)  // card / modal
    static let mist      = Color(hex: 0xF3F0E8)  // soft panel
    static let haze      = Color(hex: 0xECE8DE)  // deeper panel

    // Ink
    static let ink       = Color(hex: 0x0B0B0B)
    static let ink90     = Color(hex: 0x1C1C1C)
    static let ink70     = Color(hex: 0x3B3832)
    static let ink60     = Color(hex: 0x5B564C)
    static let ink40     = Color(hex: 0x8F8A82)
    static let ink20     = Color(hex: 0xC8C3BB)

    // Lines
    static let line      = Color(hex: 0xE5E0D4)
    static let lineSoft  = Color(hex: 0xEFECE3)

    // Reserved accents — never for large surfaces
    static let oxblood   = Color(hex: 0x6E2B2B)
    static let moss      = Color(hex: 0x3E4A34)
    static let gold      = Color(hex: 0xB08A3E)
}

extension Color {
    /// Initialize a Color from a 0xRRGGBB hex literal.
    init(hex: UInt32, opacity: Double = 1.0) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >>  8) & 0xFF) / 255.0
        let b = Double( hex        & 0xFF) / 255.0
        self.init(red: r, green: g, blue: b, opacity: opacity)
    }
}
