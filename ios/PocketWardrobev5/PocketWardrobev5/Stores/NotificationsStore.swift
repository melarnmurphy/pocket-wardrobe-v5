// Stores/NotificationsStore.swift
//
// Maps GET /api/mobile/notifications onto NotificationEntry for the
// notifications inbox. The route wraps lib/domain/notifications/service.ts
// (app_notifications table — a peer-built service, not new domain logic
// here), returning the most recent rows plus a server-computed unread
// count so the badge never has to be derived by re-scanning the list
// client-side.
//
// markRead/markAllRead call PATCH-shaped mutations (exposed as POST too,
// since MobileAPIClient only speaks GET/POST) and update local state
// optimistically on success rather than re-fetching the whole list.

import Foundation

enum NotificationKind: String, Decodable {
    case priceDrop = "price drop"
    case trendExpiry = "trend expiry"
    case offer = "offer"
    case sold = "sold"
    case ordersWaiting = "orders waiting"
    case receiptRead = "receipt read"
    case wearReminder = "wear reminder"
    case batchFinished = "batch finished"
    case message = "message"

    /// SF Symbol shown alongside the notification in the inbox row.
    var symbolName: String {
        switch self {
        case .priceDrop: return "arrow.down.circle"
        case .trendExpiry: return "hourglass"
        case .offer: return "hand.raised"
        case .sold: return "checkmark.seal"
        case .ordersWaiting: return "shippingbox"
        case .receiptRead: return "envelope.open"
        case .wearReminder: return "bell"
        case .batchFinished: return "sparkles"
        case .message: return "bubble.left"
        }
    }
}

struct NotificationRow: Decodable {
    let id: String
    let kind: NotificationKind
    let title: String
    let body: String
    let subjectKind: String?
    let subjectId: String?
    let createdAt: String
    let readAt: String?

    enum CodingKeys: String, CodingKey {
        case id, kind, title, body
        case subjectKind = "subject_kind"
        case subjectId = "subject_id"
        case createdAt = "created_at"
        case readAt = "read_at"
    }
}

struct NotificationEntry: Identifiable, Equatable {
    let id: UUID
    let kind: NotificationKind
    let title: String
    let body: String
    let subjectKind: String?
    let subjectId: UUID?
    let createdAt: Date?
    var readAt: Date?

    var isRead: Bool { readAt != nil }
}

private struct ListNotificationsResponse: Decodable {
    let notifications: [NotificationRow]
    let unreadCount: Int

    enum CodingKeys: String, CodingKey {
        case notifications
        case unreadCount = "unread_count"
    }
}

private struct MarkNotificationReadRequest: Encodable {
    let notification_id: String
}

private struct MarkAllNotificationsReadRequest: Encodable {
    let mark_all: Bool
}

private struct OkResponse: Decodable {
    let ok: Bool
}

@Observable
@MainActor
final class NotificationsStore {
    var entries: [NotificationEntry] = []
    var unreadCount: Int = 0
    var state: LoadState = .idle

    func load() async {
        guard state != .loading else { return }
        state = .loading
        do {
            let response: ListNotificationsResponse = try await MobileAPIClient.get("/api/mobile/notifications")
            entries = response.notifications.compactMap(Self.map)
            unreadCount = response.unreadCount
            state = .loaded
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    /// Optimistic: flips the local entry's read state and decrements the
    /// badge immediately rather than waiting on a re-fetch, since the
    /// server call has nothing else useful to report back.
    func markRead(id: UUID) async {
        guard let index = entries.firstIndex(where: { $0.id == id }), !entries[index].isRead else { return }

        let previousEntry = entries[index]
        let previousUnread = unreadCount
        entries[index].readAt = Date()
        unreadCount = max(0, unreadCount - 1)

        do {
            let _: OkResponse = try await MobileAPIClient.post(
                "/api/mobile/notifications",
                body: MarkNotificationReadRequest(notification_id: id.uuidString.lowercased())
            )
        } catch {
            entries[index] = previousEntry
            unreadCount = previousUnread
        }
    }

    func markAllRead() async {
        guard unreadCount > 0 else { return }

        let previousEntries = entries
        let previousUnread = unreadCount
        let now = Date()
        entries = entries.map { entry in
            var updated = entry
            if updated.readAt == nil { updated.readAt = now }
            return updated
        }
        unreadCount = 0

        do {
            let _: OkResponse = try await MobileAPIClient.post(
                "/api/mobile/notifications",
                body: MarkAllNotificationsReadRequest(mark_all: true)
            )
        } catch {
            entries = previousEntries
            unreadCount = previousUnread
        }
    }

    static func map(_ row: NotificationRow) -> NotificationEntry? {
        guard let id = UUID(uuidString: row.id) else { return nil }

        return NotificationEntry(
            id: id,
            kind: row.kind,
            title: row.title,
            body: row.body,
            subjectKind: row.subjectKind,
            subjectId: row.subjectId.flatMap { UUID(uuidString: $0) },
            createdAt: SavedOutfitsStore.parseTimestamp(row.createdAt),
            readAt: row.readAt.flatMap(SavedOutfitsStore.parseTimestamp)
        )
    }
}
