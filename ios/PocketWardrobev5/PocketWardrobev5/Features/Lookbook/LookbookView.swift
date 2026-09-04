//
//  LookbookView.swift
//  Pocket Wardrobe — saved references, boards, masonry grid.
//

import SwiftUI

struct LookbookView: View {
    @Environment(LookbookStore.self) private var lookbookStore

    @State private var selectedBoard: String = "All boards"
    @State private var selectedEntry: LookbookEntry? = nil

    private var filteredEntries: [LookbookEntry] {
        if selectedBoard == "All boards" { return lookbookStore.entries }
        return lookbookStore.entries.filter { $0.board == selectedBoard }
    }

    private var featuredBoard: LookbookBoard? {
        lookbookStore.boards.first(where: \.isFeatured)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {

                // Head
                VStack(alignment: .leading, spacing: 12) {
                    EyebrowLabel(text: "Saved · tagged · filed by board")
                    (
                        Text("Your ").foregroundColor(PWColor.ink) +
                        Text("lookbook").italic().foregroundColor(PWColor.ink) +
                        Text(".").foregroundColor(PWColor.ink)
                    )
                    .font(PWFont.display(size: 44))

                    Text("\(lookbookStore.entries.count) references across \(lookbookStore.boards.count) boards.")
                        .caption(size: 14)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 24)

                if case .error(let message) = lookbookStore.state {
                    Text(message)
                        .caption(size: 13, color: PWColor.oxblood)
                        .padding(.horizontal, PWSpacing.pageGutter)
                        .padding(.top, 24)
                } else if lookbookStore.state == .loading && lookbookStore.entries.isEmpty {
                    ProgressView()
                        .padding(.top, 64)
                        .frame(maxWidth: .infinity)
                } else if lookbookStore.entries.isEmpty {
                    Text("No saved references yet.")
                        .caption(size: 14)
                        .padding(.horizontal, PWSpacing.pageGutter)
                        .padding(.top, 24)
                } else {
                    // Stats strip
                    statsStrip
                        .padding(.horizontal, PWSpacing.pageGutter)
                        .padding(.top, 24)

                    // Board chips — edge-to-edge
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            FilterChip(label: "All boards", count: lookbookStore.entries.count,
                                       isActive: selectedBoard == "All boards") {
                                withAnimation(.easeInOut(duration: 0.15)) { selectedBoard = "All boards" }
                            }
                            ForEach(lookbookStore.boards) { board in
                                FilterChip(label: board.name, count: board.count,
                                           isActive: selectedBoard == board.name) {
                                    withAnimation(.easeInOut(duration: 0.15)) { selectedBoard = board.name }
                                }
                            }
                        }
                        .padding(.horizontal, PWSpacing.pageGutter)
                    }
                    .padding(.top, 24)

                    // Featured board card
                    if let featured = featuredBoard, selectedBoard == "All boards" {
                        featuredCard(board: featured)
                            .padding(.horizontal, PWSpacing.pageGutter)
                            .padding(.top, 32)
                    }

                    // Section heading for masonry
                    VStack(alignment: .leading, spacing: 6) {
                        EyebrowLabel(text: "\(filteredEntries.count) references")
                        Text(selectedBoard == "All boards" ? "All boards." : "\(selectedBoard).")
                            .font(PWFont.display(size: 24))
                            .foregroundStyle(PWColor.ink)
                    }
                    .padding(.horizontal, PWSpacing.pageGutter)
                    .padding(.top, 40)

                    // Uniform two-column grid
                    grid
                        .padding(.horizontal, PWSpacing.pageGutter)
                        .padding(.top, 20)
                }

                Spacer(minLength: 56)
            }
        }
        .background(PWColor.ivory)
        .task {
            await lookbookStore.load()
        }
        .refreshable {
            await lookbookStore.load()
        }
        .sheet(item: $selectedEntry) { entry in
            LookbookEntrySheet(entry: entry)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Featured board hero

    private func featuredCard(board: LookbookBoard) -> some View {
        ZStack(alignment: .bottomLeading) {
            AsyncImage(url: board.heroURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fill)
                default:
                    PWColor.haze
                }
            }
            .frame(height: 260)
            .frame(maxWidth: .infinity)
            .clipped()

            LinearGradient(
                colors: [Color.black.opacity(0.05), Color.black.opacity(0.65)],
                startPoint: .top, endPoint: .bottom
            )
            .frame(height: 260)

            VStack(alignment: .leading, spacing: 10) {
                Text("Featured board".uppercased())
                    .font(PWFont.body(size: 10, weight: .medium))
                    .tracking(10 * 0.18)
                    .foregroundStyle(PWColor.ivory.opacity(0.8))
                Text(board.name)
                    .font(PWFont.display(size: 30))
                    .foregroundStyle(PWColor.ivory)
                Text("\(board.count) references · \(board.ownedCount) owned · \(board.missingCount) missing")
                    .font(PWFont.body(size: 12))
                    .foregroundStyle(PWColor.ivory.opacity(0.75))
            }
            .padding(22)
        }
        .frame(height: 260)
        .clipShape(RoundedRectangle(cornerRadius: PWRadius.md))
        .onTapGesture {
            withAnimation(.easeInOut(duration: 0.15)) { selectedBoard = board.name }
        }
    }

    // MARK: - Grid

    private let gridColumns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    private var grid: some View {
        LazyVGrid(columns: gridColumns, spacing: 20) {
            ForEach(filteredEntries) { entry in
                LookbookCardView(entry: entry) {
                    selectedEntry = entry
                }
            }
        }
    }

    // MARK: - Stats strip

    private var statsStrip: some View {
        HStack(spacing: 0) {
            stat("\(lookbookStore.entries.count)", "refs")
            Divider().frame(height: 42).background(PWColor.line)
            stat("\(lookbookStore.boards.count)", "boards")
            Divider().frame(height: 42).background(PWColor.line)
            stat("\(lookbookStore.entries.filter { $0.missingPiece != nil }.count)", "missing")
            Divider().frame(height: 42).background(PWColor.line)
            stat("\(lookbookStore.entries.filter { !$0.ownedPieceIDs.isEmpty }.count)", "owned")
        }
        .padding(.vertical, 16)
        .overlay(Rectangle().fill(PWColor.line).frame(height: 1), alignment: .top)
        .overlay(Rectangle().fill(PWColor.line).frame(height: 1), alignment: .bottom)
    }

    private func stat(_ n: String, _ l: String) -> some View {
        VStack(spacing: 4) {
            Text(n).font(PWFont.display(size: 24)).foregroundStyle(PWColor.ink)
            EyebrowLabel(text: l, color: PWColor.ink40)
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    LookbookView()
        .environment(LookbookStore())
}
