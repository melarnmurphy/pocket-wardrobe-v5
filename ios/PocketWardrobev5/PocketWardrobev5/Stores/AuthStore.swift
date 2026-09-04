// Stores/AuthStore.swift
import Foundation
import Supabase

@Observable
@MainActor
final class AuthStore {
    var session: Session?
    var isBootstrapping = true
    var errorMessage: String?

    var isSignedIn: Bool { session != nil }

    init() {
        Task { [weak self] in
            guard let self else { return }
            for await (event, session) in AppSupabase.shared.auth.authStateChanges {
                switch event {
                case .initialSession, .signedIn, .tokenRefreshed, .userUpdated:
                    self.session = session
                case .signedOut, .userDeleted:
                    self.session = nil
                default:
                    break
                }
                self.isBootstrapping = false
            }
        }
    }

    func signIn(email: String, password: String) async {
        errorMessage = nil
        do {
            let response = try await AppSupabase.shared.auth.signIn(email: email, password: password)
            session = response
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signUp(email: String, password: String) async {
        errorMessage = nil
        do {
            let response = try await AppSupabase.shared.auth.signUp(email: email, password: password)
            session = response.session
            if response.session == nil {
                errorMessage = "Check your email to confirm your account, then sign in."
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() async {
        do {
            try await AppSupabase.shared.auth.signOut()
            session = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
