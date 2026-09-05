//
//  NotificationsView.swift
//  Pocket Wardrobe — notifications inbox.
//
//  Presented as a sheet (see NotificationsStore.swift's header for the
//  wiring this expects — a bell button elsewhere presents this view and
//  injects NotificationsStore via the environment). Tapping a row marks it
//  read; "Mark all read" clears the whole badge in one call.

import SwiftUI

struct NotificationsView: View {
    @Environment(NotificationsStore.self) private var notificationsStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {

                    // Head
                    VStack(alignment: .leading, spacing: 12) {
                        EyebrowLabel(text: notificationsStore.unreadCount > 0
                            ? "\(notificationsStore.unreadCount) unread"
                            : "All caught up")
                        Text("Notifications.")
                            .display(size: 36)
                    }
                    .padding(.horizontal, PWSpacing.pageGutter)
                    .padding(.top, 20)

                    if case .error(let message) = notificationsStore.state {
                        Text(message)
                            .caption(size: 13, color: PWColor.oxblood)
                            .padding(.horizontal, PWSpacing.pageGutter)
                            .padding(.top, 24)
                    } else if notificationsStore.state == .loading && notificationsStore.entries.isEmpty {
                        ProgressView()
                            .padding(.top, 64)
                            .frame(maxWidth: .infinity)
                    } else if notificationsStore.entries.isEmpty {
                        Text("Nothing here yet. Price drops, offers and reminders will show up in this inbox.")
                            .caption(size: 14)
                            .padding(.horizontal, PWSpacing.pageGutter)
                            .padding(.top, 24)
                    } else {
                        VStack(spacing: 0) {
                            ForEach(notificationsStore.entries) { entry in
                                NotificationRowView(entry: entry) {
                                    Task { await notificationsStore.markRead(id: entry.id) }
                                }
                                HairlineDivider()
                            }
                        }
                        .padding(.top, 20)
                        .overlay(Rectangle().fill(PWColor.line).frame(height: 1), alignment: .top)
                    }

                    Spacer(minLength: 56)
                }
            }
            .background(PWColor.ivory)
            .task {
                await notificationsStore.load()
            }
            .refreshable {
                await notificationsStore.load()
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                        .font(PWFont.body(size: 14))
                        .foregroundStyle(PWColor.ink70)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Mark all read") {
                        Task { await notificationsStore.markAllRead() }
                    }
                    .font(PWFont.body(size: 14, weight: .medium))
                    .foregroundStyle(notificationsStore.unreadCount > 0 ? PWColor.ink : PWColor.ink40)
                    .disabled(notificationsStore.unreadCount == 0)
                }
            }
        }
    }
}

// MARK: - Row

private struct NotificationRowView: View {
    let entry: NotificationEntry
    var onTap: () -> Void = {}

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: entry.kind.symbolName)
                    .font(.system(size: 16))
                    .foregroundStyle(entry.isRead ? PWColor.ink40 : PWColor.ink)
                    .frame(width: 22)
                    .padding(.top, 2)

                VStack(alignment: .leading, spacing: 4) {
                    Text(entry.title)
                        .font(PWFont.body(size: 15, weight: entry.isRead ? .regular : .semibold))
                        .foregroundStyle(PWColor.ink)
                    Text(entry.body)
                        .caption(size: 13)
                        .lineLimit(3)
                    if let createdAt = entry.createdAt {
                        Text(createdAt, style: .relative)
                            .font(PWFont.mono(size: 10))
                            .foregroundStyle(PWColor.ink40)
                    }
                }

                Spacer(minLength: 0)

                if !entry.isRead {
                    Circle()
                        .fill(PWColor.oxblood)
                        .frame(width: 8, height: 8)
                        .padding(.top, 6)
                }
            }
            .padding(.horizontal, PWSpacing.pageGutter)
            .padding(.vertical, 16)
            .background(entry.isRead ? Color.clear : PWColor.mist.opacity(0.5))
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    NotificationsView()
        .environment(NotificationsStore())
}
