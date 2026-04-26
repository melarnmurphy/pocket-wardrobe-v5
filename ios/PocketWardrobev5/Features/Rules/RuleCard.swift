//
//  RuleCard.swift
//  Pocket Wardrobe — one rule rendered as a card.
//

import SwiftUI

struct RuleCardView: View {
    @State var rule: StyleRule

    var onTap: (() -> Void) = {}

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 14) {
                // Top: sentence + scope chip
                HStack(alignment: .top, spacing: 12) {
                    sentence
                        .frame(maxWidth: .infinity, alignment: .leading)

                    switch rule.scope {
                    case .canon:
                        if !rule.isActive {
                            ScopeChip(kind: .muted)
                        } else {
                            ScopeChip(kind: .canon)
                        }
                    case .yours:
                        if !rule.isActive {
                            ScopeChip(kind: .muted)
                        } else {
                            ScopeChip(kind: .yours)
                        }
                    }
                }

                // Visualization
                vizRow

                // Bottom: weight bar + usage + toggle
                HairlineDivider(color: PWColor.lineSoft)
                HStack(spacing: 12) {
                    HStack(spacing: 10) {
                        EyebrowLabel(text: "Weight", color: PWColor.ink60)
                        WeightBar(value: rule.weight,
                                  tint: rule.predicate == .avoidWith ? PWColor.oxblood : PWColor.ink,
                                  maxWidth: 100)
                        Text(String(format: "%.2f", rule.weight))
                            .font(PWFont.mono(size: 11))
                            .foregroundStyle(PWColor.ink)
                    }
                    Spacer(minLength: 8)
                    PWSwitch(isOn: $rule.isActive)
                }

                Text(rule.usage.summary)
                    .font(PWFont.body(size: 11))
                    .foregroundStyle(PWColor.ink60)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(rule.isActive ? PWColor.paper : PWColor.mist)
            .opacity(rule.isActive ? 1 : 0.75)
            .overlay(
                RoundedRectangle(cornerRadius: PWRadius.md)
                    .stroke(PWColor.line, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: PWRadius.md))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Sentence

    private var sentence: some View {
        let parts = rule.subject
        let verb = rule.predicate.verbPhrase
        let object = rule.object
        return (
            Text(parts).foregroundColor(PWColor.ink) +
            Text(" \(verb) ").italic().foregroundColor(PWColor.ink70) +
            Text(object).foregroundColor(PWColor.ink) +
            Text(".").foregroundColor(PWColor.ink)
        )
        .font(PWFont.display(size: 17))
        .lineSpacing(2)
    }

    // MARK: - Viz row

    @ViewBuilder
    private var vizRow: some View {
        switch rule.viz {
        case let .swatchPair(a, b):
            HStack(spacing: 10) {
                HStack(spacing: 0) {
                    Circle()
                        .fill(Color(hex: a))
                        .frame(width: 22, height: 22)
                        .overlay(Circle().stroke(PWColor.line, lineWidth: 1))
                        .offset(x: 4)
                    Circle()
                        .fill(Color(hex: b))
                        .frame(width: 22, height: 22)
                        .overlay(Circle().stroke(PWColor.line, lineWidth: 1))
                }
                Spacer(minLength: 0)
            }

        case let .glyph(symbol):
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .strokeBorder(PWColor.line, lineWidth: 1)
                        .background(Circle().fill(PWColor.paper))
                        .frame(width: 34, height: 34)
                    Image(systemName: symbol)
                        .font(.system(size: 13, weight: .regular))
                        .foregroundStyle(PWColor.ink70)
                }
                Spacer(minLength: 0)
            }

        case let .iconPair(subject, connector, object):
            HStack(spacing: 10) {
                Image(systemName: subject)
                    .font(.system(size: 16))
                    .foregroundStyle(PWColor.ink60)
                Text(connector)
                    .font(PWFont.displayItalic(size: 13))
                    .foregroundStyle(PWColor.ink40)
                Image(systemName: object)
                    .font(.system(size: 16))
                    .foregroundStyle(PWColor.ink60)
                Spacer(minLength: 0)
            }
        }
    }
}

#Preview {
    VStack(spacing: 14) {
        RuleCardView(rule: SampleData.rules[0])
        RuleCardView(rule: SampleData.rules[4])
        RuleCardView(rule: SampleData.rules[10])
    }
    .padding()
    .background(PWColor.ivory)
}
