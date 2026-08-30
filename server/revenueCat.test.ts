// The mobile half of the entitlement logic. The failure mode this guards is
// the one that already happened once with Stripe: revoking premium from
// somebody who paid.
// Run: npx tsx server/revenueCat.test.ts
import assert from 'assert';
import { entitlementFor, isAuthorized } from './payments/revenueCat.js';

try {
  // Money arrived, or is still arriving.
  for (const event of [
    'INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE',
    'NON_RENEWING_PURCHASE', 'TRIAL_STARTED', 'TRIAL_CONVERTED',
  ]) {
    assert.strictEqual(entitlementFor(event), 'active', `${event} must grant access`);
  }

  // Access genuinely ended.
  for (const event of ['EXPIRATION', 'REFUND', 'SUBSCRIPTION_PAUSED']) {
    assert.strictEqual(entitlementFor(event), 'canceled', `${event} must end access`);
  }

  // The important ones. CANCELLATION means auto-renew was switched off: the
  // customer paid for this period and keeps it until EXPIRATION. Treating it
  // as a downgrade is exactly the Stripe bug fixed in c980386, arriving by a
  // different door.
  assert.strictEqual(entitlementFor('CANCELLATION'), null, 'cancelling must not revoke early');
  assert.strictEqual(entitlementFor('BILLING_ISSUE'), null, 'dunning must not revoke');
  assert.strictEqual(entitlementFor('TRANSFER'), null, 'identity bookkeeping is not entitlement');
  assert.strictEqual(entitlementFor('SUBSCRIBER_ALIAS'), null);

  // Anything RevenueCat adds later must not silently downgrade a payer.
  assert.strictEqual(entitlementFor('SOME_FUTURE_EVENT'), null);
  assert.strictEqual(entitlementFor(''), null);

  // Webhook auth.
  assert.strictEqual(isAuthorized('secret', 'secret'), true);
  assert.strictEqual(isAuthorized('wrong', 'secret'), false);
  assert.strictEqual(isAuthorized(undefined, 'secret'), false);
  assert.strictEqual(isAuthorized('short', 'a-much-longer-secret'), false, 'length mismatch');
  // An unset secret must never authorise: it would make the webhook open.
  assert.strictEqual(isAuthorized('', ''), false, 'no configured secret means no access');
  assert.strictEqual(isAuthorized('anything', ''), false);

  console.log('PASS: mobile entitlement never revokes from someone who paid');
} catch (error: any) {
  console.error('FAIL:', error.message);
  process.exitCode = 1;
}
