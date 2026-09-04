//
//  SignInView.swift
//  Pocket Wardrobe — email/password gate shown when signed out.
//

import SwiftUI

struct SignInView: View {
    @Environment(AuthStore.self) private var authStore

    @State private var email = ""
    @State private var password = ""
    @State private var mode: Mode = .signIn
    @State private var isSubmitting = false

    private enum Mode { case signIn, signUp }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 10) {
                    EyebrowLabel(text: "Pocket Wardrobe")
                    Text(mode == .signIn ? "Welcome back." : "Start your wardrobe.")
                        .display(size: 36)
                }
                .padding(.top, 64)

                VStack(alignment: .leading, spacing: 16) {
                    labelledField("Email") {
                        TextField("you@example.com", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                    labelledField("Password") {
                        SecureField("••••••••", text: $password)
                            .textContentType(mode == .signIn ? .password : .newPassword)
                    }
                }

                if let errorMessage = authStore.errorMessage {
                    Text(errorMessage)
                        .caption(size: 13, color: PWColor.oxblood)
                }

                PWButton(
                    title: isSubmitting ? "Please wait" : (mode == .signIn ? "Sign in" : "Create account"),
                    style: .primary
                ) {
                    submit()
                }
                .disabled(isSubmitting || email.isEmpty || password.isEmpty)
                .opacity(isSubmitting || email.isEmpty || password.isEmpty ? 0.5 : 1)

                Button {
                    authStore.errorMessage = nil
                    mode = mode == .signIn ? .signUp : .signIn
                } label: {
                    Text(mode == .signIn ? "New here? Create an account" : "Already have an account? Sign in")
                        .caption(size: 13, color: PWColor.ink60)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, PWSpacing.pageGutter)
            .padding(.bottom, 48)
        }
        .background(PWColor.ivory)
    }

    @ViewBuilder
    private func labelledField<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .caption(size: 12, color: PWColor.ink60)
            content()
                .font(PWFont.body(size: 15))
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(PWColor.paper)
                .overlay(
                    RoundedRectangle(cornerRadius: PWRadius.xs)
                        .stroke(PWColor.line, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: PWRadius.xs))
        }
    }

    private func submit() {
        isSubmitting = true
        Task {
            switch mode {
            case .signIn:
                await authStore.signIn(email: email, password: password)
            case .signUp:
                await authStore.signUp(email: email, password: password)
            }
            isSubmitting = false
        }
    }
}

#Preview {
    SignInView()
        .environment(AuthStore())
}
