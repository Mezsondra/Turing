/**
 * RevenueCat webhooks: the entitlement source for iOS and Android.
 *
 * Apple and Google both require their own billing for digital goods, so Stripe
 * is web-only and mobile purchases arrive here instead. Both write the same
 * provider-specific entitlement, and premium access is the union of all
 * providers rather than whichever webhook happened to arrive last.
 *
 * The mapping below is deliberately shaped like the Stripe one in
 * stripeService.ts, and for the same reason: collapsing every non-renewing
 * event into "canceled" is what revoked access from paying customers last time.
 * CANCELLATION here means auto-renew was switched off, NOT that access ended -
 * the customer keeps what they paid for until EXPIRATION arrives.
 */
import { timingSafeEqual } from 'crypto';

export type EntitlementChange = 'active' | 'canceled' | null;

/**
 * What an event does to the row. `null` means "no decision" and leaves the row
 * untouched - including for any event type RevenueCat adds later.
 */
export const entitlementFor = (eventType: string): EntitlementChange => {
  switch (eventType) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
    case 'NON_RENEWING_PURCHASE': // the lifetime unlock
    case 'TRIAL_STARTED':
    case 'TRIAL_CONVERTED':
      return 'active';

    // Access genuinely ended.
    case 'EXPIRATION':
    case 'REFUND':
    case 'SUBSCRIPTION_PAUSED':
      return 'canceled';

    // Explicitly NOT a downgrade:
    // - CANCELLATION: auto-renew off, still paid up until EXPIRATION.
    // - BILLING_ISSUE: the store is retrying, same as Stripe's past_due.
    // - TRANSFER / SUBSCRIBER_ALIAS: identity bookkeeping, not entitlement.
    default:
      return null;
  }
};

/** Constant-time check of the Authorization header set in RevenueCat. */
export const isAuthorized = (header: string | undefined, secret: string): boolean => {
  if (!secret) return false;
  const provided = Buffer.from(header || '');
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
};

export interface RevenueCatEvent {
  id?: string;
  type?: string;
  app_user_id?: string;
  product_id?: string;
  transaction_id?: string;
  original_transaction_id?: string;
  purchased_at_ms?: number;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
}
