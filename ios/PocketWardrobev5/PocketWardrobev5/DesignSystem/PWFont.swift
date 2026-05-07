//
//  PWFont.swift
//  Pocket Wardrobe — typography
//
//  Display  → Fraunces (variable serif, weight 300, negative tracking)
//  Body/UI  → Inter
//  Numbers  → JetBrains Mono
//
//  If the custom fonts aren't registered (fresh project, no TTFs bundled yet), we fall
//  back to Apple's system faces so the app always renders something editorial:
//    - NewYork  (serif)     ≈ Fraunces stand-in
//    - SF Pro   (sans)      ≈ Inter stand-in
//    - SF Mono  (monospace) ≈ JetBrains Mono stand-in
//

import SwiftUI
import UIKit

enum PWFont {

    // MARK: - Availability

    /// Is a given PostScript font family actually registered?
    private static func isRegistered(_ name: String) -> Bool {
        UIFont.familyNames.contains { UIFont.fontNames(forFamilyName: $0).contains(name) }
    }

    private static let hasFraunces  = isRegistered("Fraunces9pt-Light")
    private static let hasInter     = isRegistered("Inter-Regular")
    private static let hasJBMono    = isRegistered("JetBrainsMono-Regular")

    // MARK: - Display (Fraunces, weight 300)

    static func display(size: CGFloat) -> Font {
        if hasFraunces {
            return .custom("Fraunces9pt-Light", size: size)
        } else {
            return .system(size: size, weight: .light, design: .serif)
        }
    }

    static func displayItalic(size: CGFloat) -> Font {
        if hasFraunces {
            return .custom("Fraunces9pt-LightItalic", size: size)
        } else {
            return .system(size: size, weight: .light, design: .serif).italic()
        }
    }

    // MARK: - Body (Inter)

    static func body(size: CGFloat = 15, weight: Font.Weight = .regular) -> Font {
        if hasInter {
            let face: String = {
                switch weight {
                case .light:    return "Inter-Light"
                case .medium:   return "Inter-Medium"
                case .semibold: return "Inter-SemiBold"
                case .bold:     return "Inter-Bold"
                default:        return "Inter-Regular"
                }
            }()
            return .custom(face, size: size)
        } else {
            return .system(size: size, weight: weight, design: .default)
        }
    }

    // MARK: - Mono (JetBrains Mono)

    static func mono(size: CGFloat = 11) -> Font {
        if hasJBMono {
            return .custom("JetBrainsMono-Regular", size: size)
        } else {
            return .system(size: size, weight: .regular, design: .monospaced)
        }
    }
}

// MARK: - Semantic text styles

extension Text {

    /// Small caps label, 0.18em tracking. Used for section titles and overlines.
    func eyebrow(_ color: Color = PWColor.ink60) -> some View {
        self
            .font(PWFont.body(size: 11, weight: .medium))
            .tracking(11 * 0.18)           // SwiftUI tracking is in points, convert em→pt
            .textCase(.uppercase)
            .foregroundStyle(color)
    }

    /// Editorial display heading, Fraunces light.
    func display(size: CGFloat = 40, color: Color = PWColor.ink) -> some View {
        self
            .font(PWFont.display(size: size))
            .tracking(-size * 0.01)         // Roughly -0.01em
            .foregroundStyle(color)
    }

    /// Soft caption text.
    func caption(size: CGFloat = 13, color: Color = PWColor.ink60) -> some View {
        self
            .font(PWFont.body(size: size))
            .foregroundStyle(color)
            .lineSpacing(2)
    }
}
