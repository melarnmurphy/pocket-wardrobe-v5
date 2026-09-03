import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { getServerEnv } from "@/lib/env";
import { syncUserEntitlementsFromBillingEvent } from "@/lib/domain/billing/service";

function planTierForSubscriptionStatus(status: Stripe.Subscription.Status): "free" | "premium" {
  return status === "active" || status === "trialing" ? "premium" : "free";
}

function billingStatusForSubscriptionStatus(
  status: Stripe.Subscription.Status
): "active" | "payment_failed" | "lapsed" | null {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid") return "payment_failed";
  if (status === "canceled" || status === "incomplete_expired") return "lapsed";
  return null;
}

function subscriptionCustomerId(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
}

/**
 * Every code path below resolves the Supabase user from the subscription's
 * own metadata.supabase_user_id, set once at checkout (createPlusCheckoutSession)
 * and immutable after that — never from a webhook payload's customer/session
 * id, which would require trusting Stripe's IDs as if they were already
 * mapped to a user, when that mapping is exactly what this metadata field
 * exists to carry.
 */
async function syncFromSubscription(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    return;
  }

  await syncUserEntitlementsFromBillingEvent({
    user_id: userId,
    plan_tier: planTierForSubscriptionStatus(subscription.status),
    billing_provider: "stripe",
    billing_customer_id: subscriptionCustomerId(subscription),
    billing_subscription_id: subscription.id,
    billing_status: billingStatusForSubscriptionStatus(subscription.status)
  });
}

export async function POST(request: NextRequest) {
  const env = getServerEnv();

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhooks are not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  // constructEvent needs the exact raw bytes Stripe signed — request.json()
  // would re-serialize and break signature verification.
  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (typeof session.subscription === "string") {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await syncFromSubscription(subscription);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncFromSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionRef = invoice.parent?.subscription_details?.subscription;
        if (subscriptionRef) {
          const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncFromSubscription(subscription);
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook handling failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
