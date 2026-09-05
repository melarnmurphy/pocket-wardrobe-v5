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
        try await send(path: path, method: "GET", contentType: nil, body: nil)
    }

    static func post<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let data = try JSONEncoder().encode(body)
        return try await send(path: path, method: "POST", contentType: "application/json", body: data)
    }

    /// Uploads a single photo as multipart/form-data (field name "photo"),
    /// matching what the /api/mobile/wardrobe/capture route expects.
    static func uploadPhoto<T: Decodable>(_ path: String, imageData: Data, filename: String, mimeType: String) async throws -> T {
        try await uploadMultipart(path, fields: [:], imageData: imageData, filename: filename, mimeType: mimeType)
    }

    /// Same multipart upload as `uploadPhoto`, plus plain string form fields
    /// alongside the "photo" file part — for routes like
    /// /api/mobile/wear-events that take both a photo and other fields
    /// (garment_ids, worn_at, occasion, notes) in one submission. The photo
    /// is optional here: pass nil imageData to send fields only.
    static func uploadMultipart<T: Decodable>(
        _ path: String,
        fields: [String: String],
        imageData: Data?,
        filename: String = "photo.jpg",
        mimeType: String = "image/jpeg"
    ) async throws -> T {
        let boundary = "PocketWardrobe-\(UUID().uuidString)"
        var body = Data()

        for (name, value) in fields {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
            body.append(value.data(using: .utf8)!)
            body.append("\r\n".data(using: .utf8)!)
        }

        if let imageData {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"photo\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
            body.append(imageData)
            body.append("\r\n".data(using: .utf8)!)
        }

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        return try await send(
            path: path,
            method: "POST",
            contentType: "multipart/form-data; boundary=\(boundary)",
            body: body
        )
    }

    private static func send<T: Decodable>(path: String, method: String, contentType: String?, body: Data?) async throws -> T {
        guard let accessToken = AppSupabase.shared.auth.currentSession?.accessToken else {
            throw MobileAPIError.unauthenticated
        }
        guard let url = URL(string: Config.apiBaseURL + path) else {
            throw MobileAPIError.server("Invalid API URL: \(path)")
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        if let contentType {
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }
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
