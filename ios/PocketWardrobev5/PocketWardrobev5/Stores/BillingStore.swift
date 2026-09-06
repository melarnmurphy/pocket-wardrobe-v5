// Stores/BillingStore.swift
//
// Native StoreKit 2 purchase flow for the "plus" plan, mirroring what the
// web app already does via Stripe Checkout (app/account/plan-section.tsx) —
// same underlying user_entitlements row, different rail. A client can't be
// trusted to just assert "I paid": every verified transaction still gets
// re-verified server-side against Apple's own signature
// (POST /api/mobile/billing/verify-purchase -> lib/domain/billing/apple.ts)
// before user_entitlements changes, the same trust boundary the Stripe
// webhook already enforces for web.
//
// The product id below MUST match a real auto-renewable subscription
// created in App Store Connect (Monetization > Subscriptions) — nothing
// here can create that product, only reference it once it exists.

import Foundation
import StoreKit

let plusSubscriptionProductID = "com.melandwes.pocketwardrobe.plus.annual"

private struct VerifyPurchaseRequest: Encodable {
    let signed_transaction: String
}

private struct VerifyPurchaseResponse: Decodable {
    let entitlements: PlanEntitlements
}

struct PlanEntitlements: Decodable {
    let plan_tier: String
    let billing_status: String?

    var isPaid: Bool { plan_tier == "pro" || plan_tier == "premium" }
}

@Observable
@MainActor
final class BillingStore {
    var product: Product?
    var entitlements: PlanEntitlements?
    var isPurchasing = false
    var isLoadingProduct = false
    var errorMessage: String?

    private var updatesTask: Task<Void, Never>?

    /// Call once at app launch. Listens for transactions StoreKit reports
    /// outside an explicit purchase() call — renewals, a purchase approved
    /// later (Ask to Buy), or one made on another of the user's devices.
    func start() {
        guard updatesTask == nil else { return }
        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                await self?.handle(update)
            }
        }
        Task { await loadProduct() }
    }

    func loadProduct() async {
        isLoadingProduct = true
        defer { isLoadingProduct = false }
        do {
            let products = try await Product.products(for: [plusSubscriptionProductID])
            product = products.first
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// appAccountToken ties this purchase to the signed-in Supabase user —
    /// the backend checks it against the calling user's id so a verified
    /// transaction from one account can't be replayed to credit another.
    func purchase(userID: UUID) async {
        guard let product else {
            errorMessage = "Plan not available right now."
            return
        }
        isPurchasing = true
        errorMessage = nil
        defer { isPurchasing = false }

        do {
            let result = try await product.purchase(options: [.appAccountToken(userID)])
            switch result {
            case .success(let verification):
                await handle(verification)
            case .userCancelled:
                break
            case .pending:
                errorMessage = "Purchase is awaiting approval."
            @unknown default:
                break
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// "Restore purchases" — re-syncs with the App Store (e.g. after a
    /// reinstall, or a purchase made on another device) rather than trying
    /// to buy again.
    func restore() async {
        errorMessage = nil
        do {
            try await AppStore.sync()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func handle(_ verification: VerificationResult<Transaction>) async {
        // The raw signed payload lives on the VerificationResult wrapper
        // itself (available either way), not on the unwrapped Transaction —
        // it has to be captured before/alongside unwrapping.
        let jwsRepresentation = verification.jwsRepresentation

        switch verification {
        case .verified(let transaction):
            await sync(jwsRepresentation: jwsRepresentation)
            await transaction.finish()
        case .unverified:
            errorMessage = "Could not verify this purchase."
        }
    }

    private func sync(jwsRepresentation: String) async {
        do {
            let body = VerifyPurchaseRequest(signed_transaction: jwsRepresentation)
            let response: VerifyPurchaseResponse = try await MobileAPIClient.post(
                "/api/mobile/billing/verify-purchase",
                body: body
            )
            entitlements = response.entitlements
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
