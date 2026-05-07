//
//  PWSpacing.swift
//  Pocket Wardrobe — spacing + radius scale (matches --s-* and --r-* in styles.css)
//

import CoreGraphics

enum PWSpacing {
    static let s1: CGFloat = 4
    static let s2: CGFloat = 8
    static let s3: CGFloat = 12
    static let s4: CGFloat = 16
    static let s5: CGFloat = 24
    static let s6: CGFloat = 32
    static let s7: CGFloat = 48
    static let s8: CGFloat = 64
    static let s9: CGFloat = 96

    /// Standard page horizontal inset.
    static let pageGutter: CGFloat = 20
}

enum PWRadius {
    static let xs: CGFloat = 2
    static let sm: CGFloat = 4
    static let md: CGFloat = 8
    static let lg: CGFloat = 12
    static let pill: CGFloat = 999
}
