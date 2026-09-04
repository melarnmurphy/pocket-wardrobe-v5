// Stores/MobileAPIClient.swift
//
// Talks to the Next.js app's /api/mobile/* routes — the ones with server-side
// generation logic (outfit generation, trend matching, style rules) that only
// exist as web business logic. Everything else (garments) reads Supabase
// directly, same as the web app's simple table reads.

import Foundation
import Supabase

private struct MobileAPIErrorBody: Decodable { let error: String? }

enum MobileAPIError: Error, LocalizedError {
    case unauthenticated
    case server(String)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .unauthenticated: return "Sign in again to continue."
        case .server(let message): return message
        case .transport(let error): return error.localizedDescription
        }
    }
}

enum MobileAPIClient {
    static func get<T: Decodable>(_ path: String) async throws -> T {
        try await send(path: path, method: "GET", body: nil)
    }

    static func post<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let data = try JSONEncoder().encode(body)
        return try await send(path: path, method: "POST", body: data)
    }

    private static func send<T: Decodable>(path: String, method: String, body: Data?) async throws -> T {
        guard let accessToken = AppSupabase.shared.auth.currentSession?.accessToken else {
            throw MobileAPIError.unauthenticated
        }
        guard let url = URL(string: Config.apiBaseURL + path) else {
            throw MobileAPIError.server("Invalid API URL: \(path)")
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw MobileAPIError.transport(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw MobileAPIError.server("No HTTP response")
        }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 { throw MobileAPIError.unauthenticated }
            let message = (try? JSONDecoder().decode(MobileAPIErrorBody.self, from: data))?.error
                ?? "Request failed (\(http.statusCode))"
            throw MobileAPIError.server(message)
        }

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw MobileAPIError.transport(error)
        }
    }
}
