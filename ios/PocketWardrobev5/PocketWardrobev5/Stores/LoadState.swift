// Stores/LoadState.swift
enum LoadState: Equatable {
    case idle
    case loading
    case loaded
    case error(String)
}
