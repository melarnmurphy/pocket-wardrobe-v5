//
//  LogOutfitSheet.swift
//  Pocket Wardrobe — "what you wore today" capture.
//
//  Stubbed: presents the UI, doesn't actually save or push a PhotoPicker yet.
//

import SwiftUI

struct LogOutfitSheet: View {
    let date: Date
    @Environment(\.dismiss) private var dismiss

    @State private var source: Source = .camera
    @State private var occasion: String = ""
    @State private var feeling: String = ""
    @State private var favourite: Bool = false

    enum Source: Hashable { case camera, photoLibrary, closet }

    private var dateString: String {
        let f = DateFormatter()
        f.timeZone = TimeZone(identifier: "Europe/Amsterdam")
        f.dateFormat = "EEEE, MMMM d"
        return f.string(from: date)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {

                    VStack(alignment: .leading, spacing: 8) {
                        EyebrowLabel(text: dateString)
                        Text("What you wore.").display(size: 32)
                    }
                    .padding(.top, 24)

                    // Photo drop zone
                    photoDropZone
                        .padding(.top, 24)

                    // Source picker
                    VStack(alignment: .leading, spacing: 12) {
                        EyebrowLabel(text: "Source")
                        VStack(spacing: 10) {
                            sourceOption(.camera,        icon: "camera",         title: "Take a photo",   sub: "Open camera now")
                            sourceOption(.photoLibrary,  icon: "photo.on.rectangle", title: "From photo library", sub: "Pick a shot you already have")
                            sourceOption(.closet,        icon: "tray",           title: "From your closet", sub: "Pick pieces, no photo")
                        }
                    }
                    .padding(.top, 28)

                    // Occasion
                    VStack(alignment: .leading, spacing: 10) {
                        EyebrowLabel(text: "Occasion")
                        TextField("Studio day, dinner, weekend…", text: $occasion)
                            .textFieldStyle(EditorialTextFieldStyle())
                    }
                    .padding(.top, 24)

                    // Feeling
                    VStack(alignment: .leading, spacing: 10) {
                        EyebrowLabel(text: "How'd it feel?")
                        TextField("One line for future-you.", text: $feeling)
                            .textFieldStyle(EditorialTextFieldStyle())
                    }
                    .padding(.top, 20)

                    // Favourite switch
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Mark as favourite")
                                .font(PWFont.display(size: 16))
                                .foregroundStyle(PWColor.ink)
                            Text("Easier to re-wear later.")
                                .font(PWFont.body(size: 12))
                                .foregroundStyle(PWColor.ink60)
                        }
                        Spacer()
                        PWSwitch(isOn: $favourite)
                    }
                    .padding(16)
                    .background(
                        RoundedRectangle(cornerRadius: PWRadius.sm)
                            .stroke(PWColor.line, lineWidth: 1)
                    )
                    .padding(.top, 24)

                    // Save
                    HStack(spacing: 10) {
                        PWButton(title: "Save to diary", style: .primary) { dismiss() }
                        PWButton(title: "Cancel", style: .ghost) { dismiss() }
                    }
                    .padding(.top, 28)
                    .padding(.bottom, 40)
                }
                .padding(.horizontal, PWSpacing.pageGutter)
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

    private var photoDropZone: some View {
        ZStack {
            RoundedRectangle(cornerRadius: PWRadius.md)
                .fill(PWColor.mist)
                .overlay(
                    RoundedRectangle(cornerRadius: PWRadius.md)
                        .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                        .foregroundStyle(PWColor.ink40)
                )
            VStack(spacing: 10) {
                Image(systemName: "camera.fill")
                    .font(.system(size: 28, weight: .light))
                    .foregroundStyle(PWColor.ink60)
                Text("Photo of you in it").display(size: 18)
                Text("Tap to add. A mirror selfie is fine.")
                    .font(PWFont.body(size: 12))
                    .foregroundStyle(PWColor.ink60)
            }
        }
        .frame(height: 220)
    }

    private func sourceOption(_ value: Source, icon: String, title: String, sub: String) -> some View {
        let isSelected = source == value
        return Button {
            source = value
        } label: {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .regular))
                    .frame(width: 36, height: 36)
                    .foregroundStyle(isSelected ? PWColor.ivory : PWColor.ink)
                    .background(isSelected ? PWColor.ink : PWColor.paper)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(isSelected ? PWColor.ink : PWColor.line, lineWidth: 1))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(PWFont.display(size: 16)).foregroundStyle(PWColor.ink)
                    Text(sub).font(PWFont.body(size: 11)).foregroundStyle(PWColor.ink60)
                }
                Spacer()
                Image(systemName: isSelected ? "circle.inset.filled" : "circle")
                    .font(.system(size: 18, weight: .regular))
                    .foregroundStyle(isSelected ? PWColor.ink : PWColor.ink40)
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: PWRadius.sm)
                    .stroke(isSelected ? PWColor.ink : PWColor.line, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

struct EditorialTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .font(PWFont.display(size: 16))
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: PWRadius.sm)
                    .stroke(PWColor.line, lineWidth: 1)
            )
    }
}

#Preview {
    LogOutfitSheet(date: SampleData.today)
}
