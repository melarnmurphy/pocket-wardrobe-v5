//
//  PlannerContainerView.swift
//  Pocket Wardrobe — the Planner tab, with a Week (plan) / Month (diary) toggle.
//
//  Mirrors the web convention where Diary lives inside the Planner tab.
//

import SwiftUI

struct PlannerContainerView: View {
    enum Mode: String, CaseIterable, Hashable {
        case week, month

        var label: String {
            switch self {
            case .week: return "Week"
            case .month: return "Month"
            }
        }

        var caption: String {
            switch self {
            case .week: return "plan"
            case .month: return "diary"
            }
        }

        var icon: String {
            switch self {
            case .week: return "calendar"
            case .month: return "calendar.badge.plus"
            }
        }
    }

    @State private var mode: Mode = .week

    var body: some View {
        VStack(spacing: 0) {
            // View toggle at the very top
            HStack(spacing: 0) {
                ForEach(Mode.allCases, id: \.self) { m in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { mode = m }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: m.icon)
                                .font(.system(size: 11))
                            Text(m.label)
                                .font(PWFont.body(size: 11, weight: .medium))
                                .tracking(11 * 0.14)
                                .textCase(.uppercase)
                            Text("· \(m.caption)")
                                .font(PWFont.body(size: 11))
                                .foregroundStyle(mode == m ? PWColor.ivory.opacity(0.6) : PWColor.ink40)
                        }
                        .foregroundStyle(mode == m ? PWColor.ivory : PWColor.ink70)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 9)
                        .frame(maxWidth: .infinity)
                        .background(mode == m ? PWColor.ink : .clear)
                    }
                    .buttonStyle(.plain)
                }
            }
            .background(PWColor.paper)
            .overlay(
                RoundedRectangle(cornerRadius: PWRadius.pill)
                    .stroke(PWColor.line, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: PWRadius.pill))
            .padding(.horizontal, PWSpacing.pageGutter)
            .padding(.top, 12)
            .padding(.bottom, 4)
            .background(PWColor.ivory)

            // Active content
            if mode == .week {
                PlannerView()
            } else {
                DiaryView()
            }
        }
        .background(PWColor.ivory)
    }
}

#Preview {
    PlannerContainerView()
}
