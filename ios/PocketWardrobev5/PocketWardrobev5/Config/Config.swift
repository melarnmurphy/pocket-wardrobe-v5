// Config/Config.swift
import Foundation

enum Config {
    static let supabaseURL: String     = value(for: "SUPABASE_URL")
    static let supabaseAnonKey: String = value(for: "SUPABASE_ANON_KEY")

    private static func value(for key: String) -> String {
        guard
            let path  = Bundle.main.path(forResource: "Secrets", ofType: "plist"),
            let dict  = NSDictionary(contentsOfFile: path),
            let value = dict[key] as? String,
            !value.isEmpty
        else {
            fatalError(
                "Secrets.plist is missing or does not contain '\(key)'. " +
                "Copy Secrets.example.plist → Secrets.plist and fill in the values."
            )
        }
        return value
    }
}
