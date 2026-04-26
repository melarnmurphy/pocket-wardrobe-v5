//
//  RuleDetailSheet.swift
//  Pocket Wardrobe — one rule opened for editing.
//

import SwiftUI

struct RuleDetailSheet: View {
    @State var rule: StyleRule
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {

                    // Head
                    VStack(alignment: .leading, spacing: 10) {
                        EyebrowLabel(text: "Rule · \(rule.predicate.rawValue) · \(rule.scope == .canon ? "canon" : "yours")")
                        ( Text(rule.subject).foregroundColor(PWColor.ink) +
                          Text(" \(rule.predicate.verbPhrase) ").italic().foregroundColor(PWColor.ink70) +
                          Text(rule.object).foregroundColor(PWColor.ink) +
                          Text(".").foregroundColor(PWColor.ink)
                        )
                        .font(PWFont.display(size: 28))
                    }

                    // Subject → object visualization
                    VStack(alignment: .leading, spacing: 12) {
                        EyebrowLabel(text: "Subject → Object")
                        HStack(spacing: 16) {
                            vizNode(title: rule.subject, viz: leftSide)
                            Text(rule.predicate.verbPhrase)
                                .font(PWFont.displayItalic(size: 13))
                                .foregroundStyle(PWColor.ink40)
                                .multilineTextAlignment(.center)
                            vizNode(title: rule.object, viz: rightSide)
                        }
                        .padding(20)
                        .frame(maxWidth: .infinity)
                        .background(
                            RoundedRectangle(cornerRadius: PWRadius.md)
                                .fill(PWColor.mist)
                        )
                    }

                    // Weight slider
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            EyebrowLabel(text: "Weight · how strongly this fires")
                            Spacer()
                            Text(String(format: "%.2f", rule.weight))
                                .font(PWFont.mono(size: 13))
                                .foregroundStyle(PWColor.ink)
                        }
                        Slider(value: $rule.weight, in: 0...1)
                            .tint(PWColor.ink)
                        HStack {
                            EyebrowLabel(text: "Gentle nudge", color: PWColor.ink40)
                            Spacer()
                            EyebrowLabel(text: "Canon", color: PWColor.ink40)
                        }
                    }

                    // Rationale
                    if let r = rule.rationale {
                        VStack(alignment: .leading, spacing: 10) {
                            EyebrowLabel(text: "Why it exists")
                            Text(r)
                                .font(PWFont.display(size: 17))
                                .foregroundStyle(PWColor.ink)
                                .lineSpacing(3)
                        }
                    }

                    // Context
                    VStack(spacing: 0) {
                        detailRow("Scope",     rule.scope == .canon ? "Global canon · editable for you" : "Personal · only in your wardrobe")
                        detailRow("Fired in",  "\(rule.usage.firedInOutfits) outfits")
                        detailRow("Blocked",   "\(rule.usage.blockedSuggestions) suggestions", isLast: true)
                    }

                    // Active switch
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Active")
                                .font(PWFont.display(size: 16))
                                .foregroundStyle(PWColor.ink)
                            Text("Fires in suggestions immediately.")
                                .font(PWFont.body(size: 12))
                                .foregroundStyle(PWColor.ink60)
                        }
                        Spacer()
                        PWSwitch(isOn: $rule.isActive)
                    }
                    .padding(16)
                    .background(
                        RoundedRectangle(cornerRadius: PWRadius.sm)
                            .stroke(PWColor.line, lineWidth: 1)
                    )

                    // Actions
                    HStack(spacing: 10) {
                        PWButton(title: "Save changes", style: .primary) { dismiss() }
                        PWButton(title: "Duplicate as personal", style: .outline)
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 20)
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 24)
            }
            .background(PWColor.paper)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(PWColor.ink)
                    }
                }
            }
        }
    }

    private var leftSide: AnyView {
        switch rule.viz {
        case let .swatchPair(a, _):
            return AnyView(Circle().fill(Color(hex: a)).frame(width: 48, height: 48)
                .overlay(Circle().stroke(PWColor.line, lineWidth: 1)))
        case let .glyph(symbol):
            return AnyView(symbolBubble(symbol))
        case let .iconPair(subject, _, _):
            return AnyView(symbolBubble(subject))
        }
    }

    private var rightSide: AnyView {
        switch rule.viz {
        case let .swatchPair(_, b):
            return AnyView(Circle().fill(Color(hex: b)).frame(width: 48, height: 48)
                .overlay(Circle().stroke(PWColor.line, lineWidth: 1)))
        case let .glyph(symbol):
            return AnyView(symbolBubble(symbol))
        case let .iconPair(_, _, object):
            return AnyView(symbolBubble(object))
        }
    }

    private func symbolBubble(_ name: String) -> some View {
        ZStack {
            Circle().fill(PWColor.paper).frame(width: 48, height: 48)
                .overlay(Circle().stroke(PWColor.line, lineWidth: 1))
            Image(systemName: name).font(.system(size: 18, weight: .regular)).foregroundStyle(PWColor.ink70)
        }
    }

    private func vizNode(title: String, viz: AnyView) -> some View {
        VStack(spacing: 8) {
            viz
            Text(title)
                .font(PWFont.display(size: 15))
                .foregroundStyle(PWColor.ink)
                .multilineTextAlignment(.center)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity)
    }

    private func detailRow(_ label: String, _ value: String, isLast: Bool = false) -> some View {
        VStack(spacing: 0) {
            HStack {
                Text(label)
                    .font(PWFont.body(size: 12))
                    .foregroundStyle(PWColor.ink60)
                Spacer()
                Text(value)
                    .font(PWFont.body(size: 13))
                    .foregroundStyle(PWColor.ink)
                    .multilineTextAlignment(.trailing)
            }
            .padding(.vertical, 12)
            if !isLast { HairlineDivider(color: PWColor.lineSoft) }
        }
    }
}

#Preview {
    RuleDetailSheet(rule: SampleData.rules[0])
}
