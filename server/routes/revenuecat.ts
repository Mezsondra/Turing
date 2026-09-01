import { Router, Request, Response } from 'express';
import { db } from '../database/db.js';
import { entitlementFor, isAuthorized, RevenueCatEvent } from '../payments/revenueCat.js';

const router = Router();

/**
 * RevenueCat webhook. Set the URL and the Authorization header value in the
 * RevenueCat dashboard under Integrations → Webhooks; the header is the only
 * thing authenticating this endpoint, so an unset REVENUECAT_WEBHOOK_SECRET
 * refuses everything rather than accepting anything.
 */
router.post('/webhook', (req: Request, res: Response) => {
  try {
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET || '';
    if (!isAuthorized(req.headers.authorization, secret)) {
      // 401 rather than a silent 200: RevenueCat surfaces delivery failures in
      // its dashboard, and a misconfigured secret should be visible there.
      console.warn('Rejected an unauthorised RevenueCat webhook');
      return res.status(401).json({ error: 'unauthorized' });
    }

    const event = (req.body?.event || {}) as RevenueCatEvent;
    const userId = event.app_user_id;
    if (!userId) {
      console.warn('RevenueCat event with no app_user_id');
      return res.status(200).json({ received: true });
    }

    const change = entitlementFor(event.type || '');
    const externalKey = event.original_transaction_id || event.transaction_id ||
      (event.product_id ? `${userId}:${event.product_id}` : '');
    const occurredAt = event.event_timestamp_ms || event.purchased_at_ms || Date.now();
    const eventId = event.id || (externalKey ? `${event.type}:${externalKey}:${occurredAt}` : '');
    if (!externalKey || !eventId) {
      throw new Error('RevenueCat event is missing transaction identity');
    }

    db.applyBillingEvent({
      provider: 'revenuecat',
      eventId,
      eventType: event.type || 'unknown',
      occurredAt,
      userId,
      externalKey,
      kind: event.type === 'NON_RENEWING_PURCHASE' ? 'lifetime' : 'subscription',
      status: !change
        ? null
        : change === 'active'
          ? 'active'
          : event.type === 'REFUND'
            ? 'refunded'
            : 'expired',
      currentPeriodStart: event.purchased_at_ms ?? null,
      currentPeriodEnd: event.expiration_at_ms ?? null,
    });
    console.log(`RevenueCat ${event.type} for ${userId}: ${change}`);

    res.status(200).json({ received: true });
  } catch (error) {
    // 500 makes RevenueCat retry, which is what we want for a real failure.
    console.error('RevenueCat webhook failed:', error);
    res.status(500).json({ error: 'error' });
  }
});

export default router;
