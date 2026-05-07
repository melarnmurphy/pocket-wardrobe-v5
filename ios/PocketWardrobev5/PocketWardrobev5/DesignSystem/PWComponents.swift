//
//  PWComponents.swift
//  Pocket Wardrobe — shared SwiftUI components.
//
//  Keep these tiny and composable. One concept per view, no optional-packed APIs.
//  If a screen needs a bespoke variant, build it inline — don't bolt more knobs on here.
//

import SwiftUI

// MARK: - EyebrowLabel

/// Small caps label with 0.18em tracking. Used as a section pre-header.
struct EyebrowLabel: View {
    let text: String
    var color: Color = PWColor.ink60

    var body: some View {
        Text(text).eyebrow(color)
    }
}

// MARK: - PWButton

enum PWButtonStyle { case primary, outline, ghost }

struct PWButton: View {
    let title: String
    var style: PWButtonStyle = .primary
    var icon: String? = nil       // SF Symbol name
    var action: () -> Void = {}

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let icon {
                    Image(systemName: icon).font(.system(size: 11, weight: .regular))
                }
                Text(title.uppercased())
                    .font(PWFont.body(size: 11, weight: .medium))
                    .tracking(11 * 0.14)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 13)
            .foregroundStyle(foreground)
            .background(background)
            .overlay(
                RoundedRectangle(cornerRadius: PWRadius.xs)
                    .stroke(borderColor, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: PWRadius.xs))
        }
        .buttonStyle(.plain)
    }

    private var foreground: Color {
        switch style {
        case .primary:  return PWColor.ivory
        case .outline:  return PWColor.ink
        case .ghost:    return PWColor.ink70
        }
    }
    private var background: Color {
        switch style {
        case .primary:  return PWColor.ink
        case .outline:  return .clear
        case .ghost:    return .clear
        }
    }
    private var borderColor: Color {
        switch style {
        case .primary:  return PWColor.ink
        case .outline:  return PWColor.ink
        case .ghost:    return .clear
        }
    }
}

// MARK: - TagChip

enum PWTagStyle { case plain, solid, accent, moss }

struct TagChip: View {
    let text: String
    var style: PWTagStyle = .plain

    var body: some View {
        Text(text)
            .font(PWFont.body(size: 11, weight: .medium))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .foregroundStyle(foreground)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: PWRadius.xs))
            .overlay(
                RoundedRectangle(cornerRadius: PWRadius.xs)
                    .stroke(borderColor, lineWidth: 1)
            )
    }

    private var foreground: Color {
        switch style {
        case .plain:    return PWColor.ink70
        case .solid:    return PWColor.ivory
        case .accent:   return PWColor.oxblood
        case .moss:     return PWColor.moss
        }
    }
    private var background: Color {
        switch style {
        case .plain:    return PWColor.mist
        case .solid:    return PWColor.ink
        case .accent:   return PWColor.oxblood.opacity(0.08)
        case .moss:     return PWColor.moss.opacity(0.08)
        }
    }
    private var borderColor: Color {
        switch style {
        case .plain:    return PWColor.line
        case .solid:    return PWColor.ink
        case .accent:   return PWColor.oxblood.opacity(0.25)
        case .moss:     return PWColor.moss.opacity(0.25)
        }
    }
}

// MARK: - FilterChip (for the tab strip above grids)

struct FilterChip: View {
    let label: String
    let count: Int?
    let isActive: Bool
    var action: () -> Void = {}

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(label)
                    .font(PWFont.body(size: 13, weight: isActive ? .medium : .regular))
                if let count {
                    Text("\(count)")
                        .font(PWFont.mono(size: 10))
                        .foregroundStyle(isActive ? PWColor.ivory.opacity(0.6) : PWColor.ink40)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .foregroundStyle(isActive ? PWColor.ivory : PWColor.ink70)
            .background(isActive ? PWColor.ink : PWColor.paper)
            .overlay(
                RoundedRectangle(cornerRadius: PWRadius.pill)
                    .stroke(isActive ? PWColor.ink : PWColor.line, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: PWRadius.pill))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - PWSwitch

/// Ink-tinted toggle matching the web .switch control.
struct PWSwitch: View {
    @Binding var isOn: Bool

    var body: some View {
        Toggle("", isOn: $isOn)
            .labelsHidden()
            .tint(PWColor.ink)
    }
}

// MARK: - HairlineDivider

/// A 1px line in the neutral line token — not the system grey.
struct HairlineDivider: View {
    var color: Color = PWColor.line

    var body: some View {
        Rectangle()
            .fill(color)
            .frame(height: 1)
    }
}

// MARK: - WeightBar

/// Thin progress bar used on rule cards. Always shows a thumb on the right edge.
struct WeightBar: View {
    let value: Double              // 0...1
    var tint: Color = PWColor.ink
    var maxWidth: CGFloat = 140

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Rectangle()
                    .fill(PWColor.line)
                    .frame(height: 2)
                Rectangle()
                    .fill(tint)
                    .frame(
                        width: max(2, geo.size.width * CGFloat(value.clamped(to: 0...1))),
                        height: 2
                    )
            }
            .frame(height: 2)
        }
        .frame(height: 2)
        .frame(maxWidth: maxWidth)
    }
}

private extension Comparable {
    func clamped(to range: ClosedRange<Self>) -> Self {
        min(max(self, range.lowerBound), range.upperBound)
    }
}

// MARK: - ScopeChip

/// Canon (neutral) vs. Yours (ink-inverted). Very small caps tag.
struct ScopeChip: View {
    enum Kind { case canon, yours, muted }
    let kind: Kind

    var body: some View {
        Text(label)
            .font(PWFont.body(size: 9, weight: .medium))
            .tracking(9 * 0.18)
            .textCase(.uppercase)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .foregroundStyle(foreground)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: PWRadius.xs))
    }

    private var label: String {
        switch kind {
        case .canon:  return "Canon"
        case .yours:  return "Yours"
        case .muted:  return "Muted"
        }
    }
    private var foreground: Color {
        switch kind {
        case .canon:  return PWColor.ink60
        case .yours:  return PWColor.ivory
        case .muted:  return PWColor.ink40
        }
    }
    private var background: Color {
        switch kind {
        case .canon:  return PWColor.mist
        case .yours:  return PWColor.ink
        case .muted:  return PWColor.haze
        }
    }
}
