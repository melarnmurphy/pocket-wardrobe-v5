// Stores/AppSupabaseClient.swift
import Supabase
import Foundation

enum AppSupabase {
    static let shared: SupabaseClient = {
        guard let url = URL(string: Config.supabaseURL) else {
            fatalError("Invalid SUPABASE_URL in Secrets.plist: \(Config.supabaseURL)")
        }
        return SupabaseClient(supabaseURL: url, supabaseKey: Config.supabaseAnonKey)
    }()
}
