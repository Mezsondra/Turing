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
    if (!change) {
      // Not a decision. CANCELLATION and BILLING_ISSUE land here on purpose.
      console.log(`RevenueCat ${event.type} for ${userId}: no entitlement change`);
      return res.status(200).json({ received: true });
    }

    db.setMobileEntitlement(userId, change, event.expiration_at_ms ?? null);
    console.log(`RevenueCat ${event.type} for ${userId}: ${change}`);

    res.status(200).json({ received: true });
  } catch (error) {
    // 500 makes RevenueCat retry, which is what we want for a real failure.
    console.error('RevenueCat webhook failed:', error);
    res.status(500).json({ error: 'error' });
  }
});

export default router;
