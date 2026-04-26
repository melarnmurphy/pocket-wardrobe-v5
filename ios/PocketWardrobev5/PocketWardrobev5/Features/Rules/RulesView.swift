//
//  RulesView.swift
//  Pocket Wardrobe — categorized rule cards grouped by predicate.
//

import SwiftUI

struct RulesView: View {
    @State private var selectedRule: StyleRule? = nil
    @State private var activeFilter: Filter = .all

    enum Filter: Hashable, CaseIterable {
        case all, pairings, occasion, layering, avoid, seasonality, yours

        var label: String {
            switch self {
            case .all:          return "All"
            case .pairings:     return "Pairings"
            case .occasion:     return "Occasion fit"
            case .layering:     return "Layering"
            case .avoid:        return "Avoid"
            case .seasonality:  return "Seasonality"
            case .yours:        return "Your overrides"
            }
        }

        func matches(_ rule: StyleRule) -> Bool {
            switch self {
            case .all:          return true
            case .pairings:     return rule.predicate == .pairsWith
            case .occasion:     return rule.predicate == .appropriateFor
            case .layering:     return rule.predicate == .layerableWith
            case .avoid:        return rule.predicate == .avoidWith
            case .seasonality:  return rule.predicate == .seasonality
            case .yours:        return rule.scope == .yours
            }
        }
    }

    private var filteredRules: [StyleRule] {
        SampleData.rules.filter { activeFilter.matches($0) }
    }

    private var groupedRules: [(StyleRule.Predicate, [StyleRule])] {
        let predicates: [StyleRule.Predicate] = [.pairsWith, .appropriateFor, .layerableWith, .avoidWith, .seasonality]
        return predicates.compactMap { p in
            let inGroup = filteredRules.filter { $0.predicate == p }
            return inGroup.isEmpty ? nil : (p, inGroup)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {

                // Head
                VStack(alignment: .leading, spacing: 12) {
                    EyebrowLabel(text: "The grammar of your wardrobe")
                    (
                        Text("Style ").foregroundColor(PWColor.ink) +
                        Text("rules").italic().foregroundColor(PWColor.ink) +
                        Text(".").foregroundColor(PWColor.ink)
                    )
                    .font(PWFont.display(size: 44))

                    Text("The grammar that decides how pieces combine. 72 baked in from editorial canon; 12 are yours. Toggle anything off and it stops firing.")
                        .caption(size: 14)
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 24)

                // Stats strip
                statsStrip
                    .padding(.horizontal, PWSpacing.pageGutter)
                    .padding(.top, 24)

                // Filter chips
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Filter.allCases, id: \.self) { f in
                            let count: Int? = f == .all
                                ? SampleData.rules.count
                                : SampleData.rules.filter { f.matches($0) }.count
                            FilterChip(
                                label: f.label, count: count, isActive: activeFilter == f
                            ) { withAnimation(.easeInOut(duration: 0.15)) { activeFilter = f } }
                        }
                    }
                    .padding(.horizontal, PWSpacing.pageGutter)
                }
                .padding(.top, 24)

                // Sections
                ForEach(groupedRules, id: \.0) { pair in
                    let predicate = pair.0
                    let rules = pair.1
                    section(title: predicate.sectionTitle,
                            eyebrow: "Predicate · \(predicate.rawValue)",
                            rules: rules)
                }

                Spacer(minLength: 48)
            }
        }
        .background(PWColor.ivory)
        .sheet(item: $selectedRule) { rule in
            RuleDetailSheet(rule: rule)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Stats strip

    private var statsStrip: some View {
        let total = SampleData.rules.count
        let yours = SampleData.rules.filter { $0.scope == .yours }.count
        let canon = SampleData.rules.filter { $0.scope == .canon }.count
        let inactive = SampleData.rules.filter { !$0.isActive }.count

        return HStack(spacing: 0) {
            stat("\(total)", "total")
            Divider().frame(height: 42).background(PWColor.line)
            stat("\(yours)", "yours")
            Divider().frame(height: 42).background(PWColor.line)
            stat("\(canon)", "canon")
            Divider().frame(height: 42).background(PWColor.line)
            stat("\(inactive)", "inactive")
        }
        .padding(.vertical, 16)
        .overlay(
            Rectangle().fill(PWColor.line).frame(height: 1),
            alignment: .top
        )
        .overlay(
            Rectangle().fill(PWColor.line).frame(height: 1),
            alignment: .bottom
        )
    }

    private func stat(_ n: String, _ l: String) -> some View {
        VStack(spacing: 4) {
            Text(n).font(PWFont.display(size: 24)).foregroundStyle(PWColor.ink)
            EyebrowLabel(text: l, color: PWColor.ink40)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Section

    private func section(title: String, eyebrow: String, rules: [StyleRule]) -> some View {
        VStack(alignment: .leading, spacing: 20) {

            // Head
            VStack(alignment: .leading, spacing: 6) {
                EyebrowLabel(text: eyebrow)
                Text(title)
                    .font(PWFont.display(size: 24))
                    .foregroundStyle(PWColor.ink)
            }
            .padding(.bottom, 8)
            .overlay(
                Rectangle().fill(PWColor.line).frame(height: 1),
                alignment: .bottom
            )

            ForEach(rules) { rule in
                RuleCardView(rule: rule) {
                    selectedRule = rule
                }
            }
        }
        .padding(.horizontal, PWSpacing.pageGutter)
        .padding(.top, 40)
    }
}

#Preview {
    RulesView()
}
