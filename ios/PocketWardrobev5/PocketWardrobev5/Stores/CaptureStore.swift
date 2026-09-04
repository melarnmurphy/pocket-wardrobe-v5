// Stores/CaptureStore.swift
//
// Backs the photo-capture flow: upload -> POST /api/mobile/wardrobe/capture
// (gated by the paid-plan feature-labels check server-side, same as the web
// batch-add flow — falls back to an editable manual draft when the AI call
// isn't entitled) -> the returned draft(s) are shown for on-device review,
// unedited until the user confirms -> POST .../drafts/accept creates the
// real garment.

import Foundation

struct DraftReview: Identifiable {
    let id: String
    var title: String
    var category: String
    var colour: String
    var brand: String
    var material: String
    var confidence: Double
}

private struct DraftPayloadRow: Decodable {
    let title: String?
    let category: String?
    let colour: String?
    let brand: String?
    let material: String?
}

private struct DraftRow: Decodable {
    let id: String
    let draftPayloadJSON: DraftPayloadRow
    let confidence: Double?

    enum CodingKeys: String, CodingKey {
        case id, confidence
        case draftPayloadJSON = "draft_payload_json"
    }
}

private struct CaptureResponse: Decodable {
    let drafts: [DraftRow]
}

private struct AcceptDraftRequest: Encodable {
    let draft_id: String
    let title: String
    let category: String
    let colour: String?
    let brand: String?
    let material: String?
}

private struct AcceptDraftResponse: Decodable {
    let garment_id: String
}

@Observable
@MainActor
final class CaptureStore {
    var pendingReviews: [DraftReview] = []
    var state: LoadState = .idle
    var acceptError: String?

    func capture(imageData: Data) async {
        state = .loading
        do {
            let response: CaptureResponse = try await MobileAPIClient.uploadPhoto(
                "/api/mobile/wardrobe/capture",
                imageData: imageData,
                filename: "capture.jpg",
                mimeType: "image/jpeg"
            )
            pendingReviews = response.drafts.map {
                DraftReview(
                    id: $0.id,
                    title: $0.draftPayloadJSON.title ?? "",
                    category: $0.draftPayloadJSON.category ?? "",
                    colour: $0.draftPayloadJSON.colour ?? "",
                    brand: $0.draftPayloadJSON.brand ?? "",
                    material: $0.draftPayloadJSON.material ?? "",
                    confidence: $0.confidence ?? 0
                )
            }
            state = .loaded
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    /// Returns the new garment's id on success, or nil (acceptError is set) on failure.
    func accept(_ review: DraftReview) async -> String? {
        acceptError = nil
        do {
            let response: AcceptDraftResponse = try await MobileAPIClient.post(
                "/api/mobile/wardrobe/drafts/accept",
                body: AcceptDraftRequest(
                    draft_id: review.id,
                    title: review.title,
                    category: review.category,
                    colour: review.colour.isEmpty ? nil : review.colour,
                    brand: review.brand.isEmpty ? nil : review.brand,
                    material: review.material.isEmpty ? nil : review.material
                )
            )
            pendingReviews.removeAll { $0.id == review.id }
            return response.garment_id
        } catch {
            acceptError = error.localizedDescription
            return nil
        }
    }

    func discard(_ review: DraftReview) {
        pendingReviews.removeAll { $0.id == review.id }
    }

    func reset() {
        pendingReviews = []
        state = .idle
        acceptError = nil
    }
}
