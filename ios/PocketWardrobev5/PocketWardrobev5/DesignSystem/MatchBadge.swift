//
//  MatchBadge.swift
//  Pocket Wardrobe — match badges (exact / adjacent / styling / missing)
//
//  The editorial "how does this fit me?" chip that appears on garment cards and in
//  trend detail. Uses a muted ink wash keyed on semantic meaning rather than
//  rainbow colour.
//

import SwiftUI

enum MatchKind {
    case exact       // "Strong match"
    case adjacent    // "Close"
    case styling     // "Style-compatible"
    case missing     // "Missing piece"

    var label: String {
        switch self {
        case .exact:    return "Strong match"
        case .adjacent: return "Close"
        case .styling:  return "Style-compatible"
        case .missing:  return "Missing piece"
        }
    }

    var dotColor: Color {
        switch self {
        case .exact:    return PWColor.moss
        case .adjacent: return PWColor.ink70
        case .styling:  return PWColor.gold
        case .missing:  return PWColor.oxblood
        }
    }

    var background: Color {
        switch self {
        case .exact:    return PWColor.moss.opacity(0.08)
        case .adjacent: return PWColor.mist
        case .styling:  return PWColor.gold.opacity(0.10)
        case .missing:  return PWColor.oxblood.opacity(0.08)
        }
    }

    var foreground: Color {
        switch self {
        case .exact:    return PWColor.moss
        case .adjacent: return PWColor.ink70
        case .styling:  return PWColor.ink
        case .missing:  return PWColor.oxblood
        }
    }
}

struct MatchBadge: View {
    let kind: MatchKind

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(kind.dotColor)
                .frame(width: 5, height: 5)
            Text(kind.label)
                .font(PWFont.body(size: 10, weight: .medium))
                .tracking(10 * 0.10)
                .textCase(.uppercase)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .foregroundStyle(kind.foreground)
        .background(kind.background)
        .clipShape(RoundedRectangle(cornerRadius: PWRadius.xs))
    }
}

#Preview {
    VStack(spacing: 12) {
        MatchBadge(kind: .exact)
        MatchBadge(kind: .adjacent)
        MatchBadge(kind: .styling)
        MatchBadge(kind: .missing)
    }
    .padding()
    .background(PWColor.ivory)
}
