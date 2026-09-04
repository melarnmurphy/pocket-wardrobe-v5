// Features/Capture/CaptureView.swift
//
// The wardrobe "+" flow: choose camera or photo library, upload, then review
// the AI-guessed (or manual-fallback) draft before it becomes a real garment.

import SwiftUI
import PhotosUI

struct CaptureView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(GarmentStore.self) private var garmentStore
    @State private var captureStore = CaptureStore()

    @State private var showingCamera = false
    @State private var photoPickerItem: PhotosPickerItem?
    @State private var savedGarmentCount = 0

    var body: some View {
        NavigationStack {
            Group {
                if captureStore.state == .loading {
                    ProgressView("Analysing your photo…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if !captureStore.pendingReviews.isEmpty {
                    reviewList
                } else if savedGarmentCount > 0 {
                    doneState
                } else {
                    pickerPrompt
                }
            }
            .background(PWColor.ivory)
            .navigationTitle("Add a piece")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { dismiss() }
                }
            }
        }
        .fullScreenCover(isPresented: $showingCamera) {
            CameraPicker { image in
                Task { await upload(image) }
            }
            .ignoresSafeArea()
        }
        .onChange(of: photoPickerItem) { _, newItem in
            guard let newItem else { return }
            Task {
                if let data = try? await newItem.loadTransferable(type: Data.self),
                   let image = UIImage(data: data) {
                    await upload(image)
                }
                photoPickerItem = nil
            }
        }
    }

    // MARK: - Prompt

    private var pickerPrompt: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "camera")
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(PWColor.ink40)
            Text("Photograph a piece to add it to your wardrobe.")
                .caption(size: 14)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            if case .error(let message) = captureStore.state {
                Text(message)
                    .caption(size: 13, color: PWColor.oxblood)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }

            PWButton(title: "Take a photo", style: .primary, icon: "camera") {
                showingCamera = true
            }
            PhotosPicker(selection: $photoPickerItem, matching: .images) {
                Text("CHOOSE FROM LIBRARY")
                    .font(PWFont.body(size: 11, weight: .medium))
                    .tracking(11 * 0.14)
                    .foregroundStyle(PWColor.ink70)
            }
            .padding(.top, 4)
            Spacer()
            Spacer()
        }
        .padding(.horizontal, PWSpacing.pageGutter)
    }

    // MARK: - Review

    private var reviewList: some View {
        ScrollView {
            VStack(spacing: 20) {
                ForEach(captureStore.pendingReviews) { review in
                    DraftReviewCard(
                        review: binding(for: review),
                        onDiscard: { captureStore.discard(review) },
                        onConfirm: {
                            Task {
                                if await captureStore.accept(review) != nil {
                                    savedGarmentCount += 1
                                }
                            }
                        }
                    )
                }
                if let acceptError = captureStore.acceptError {
                    Text(acceptError)
                        .caption(size: 13, color: PWColor.oxblood)
                }
            }
            .padding(PWSpacing.pageGutter)
        }
    }

    private func binding(for review: DraftReview) -> Binding<DraftReview> {
        Binding(
            get: { captureStore.pendingReviews.first(where: { $0.id == review.id }) ?? review },
            set: { updated in
                if let idx = captureStore.pendingReviews.firstIndex(where: { $0.id == updated.id }) {
                    captureStore.pendingReviews[idx] = updated
                }
            }
        )
    }

    // MARK: - Done

    private var doneState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "checkmark.circle")
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(PWColor.moss)
            Text("Added \(savedGarmentCount) piece\(savedGarmentCount == 1 ? "" : "s") to your wardrobe.")
                .caption(size: 14)
            PWButton(title: "Add another", style: .outline) {
                savedGarmentCount = 0
                captureStore.reset()
            }
            PWButton(title: "Done", style: .primary) {
                Task { await garmentStore.load() }
                dismiss()
            }
            Spacer()
            Spacer()
        }
        .padding(.horizontal, PWSpacing.pageGutter)
    }

    private func upload(_ image: UIImage) async {
        guard let data = image.jpegData(compressionQuality: 0.85) else { return }
        await captureStore.capture(imageData: data)
    }
}

private struct DraftReviewCard: View {
    @Binding var review: DraftReview
    var onDiscard: () -> Void
    var onConfirm: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if review.confidence > 0 && review.confidence < 0.4 {
                Text("Low confidence — check these details.")
                    .caption(size: 12, color: PWColor.oxblood)
            }
            field("Title", $review.title)
            field("Category", $review.category)
            field("Colour", $review.colour)
            field("Brand", $review.brand)
            field("Material", $review.material)

            HStack(spacing: 10) {
                PWButton(title: "Discard", style: .ghost, action: onDiscard)
                PWButton(title: "Add to wardrobe", style: .primary, action: onConfirm)
            }
        }
        .padding(18)
        .background(PWColor.paper)
        .overlay(RoundedRectangle(cornerRadius: PWRadius.md).stroke(PWColor.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: PWRadius.md))
    }

    private func field(_ label: String, _ value: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).caption(size: 11, color: PWColor.ink60)
            TextField(label, text: value)
                .font(PWFont.body(size: 14))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(PWColor.ivory)
                .overlay(RoundedRectangle(cornerRadius: PWRadius.xs).stroke(PWColor.line, lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: PWRadius.xs))
        }
    }
}

#Preview {
    CaptureView()
        .environment(GarmentStore())
}
