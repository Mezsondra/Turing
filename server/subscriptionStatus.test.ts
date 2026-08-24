// Run: npx tsx server/subscriptionStatus.test.ts
import assert from 'assert';
import { subscriptionStatus } from './payments/stripeService.js';

try {
  // A paying customer must never be downgraded. `incomplete` is where every
  // new subscription starts, before the first charge or the 3DS challenge
  // clears, and `past_due` is Stripe retrying the card during dunning.
  // Both used to map to canceled, which revoked premium from people who paid.
  assert.strictEqual(subscriptionStatus('incomplete'), null, 'incomplete must not decide');
  assert.strictEqual(subscriptionStatus('paused'), null, 'paused must not revoke');
  assert.strictEqual(subscriptionStatus('past_due'), 'active', 'dunning keeps access');

  assert.strictEqual(subscriptionStatus('active'), 'active');
  assert.strictEqual(subscriptionStatus('trialing'), 'trialing');

  // Terminal states genuinely end the entitlement.
  for (const dead of ['canceled', 'unpaid', 'incomplete_expired'] as const) {
    assert.strictEqual(subscriptionStatus(dead), 'canceled', `should end: ${dead}`);
  }

  // An unknown status must not invent a downgrade.
  assert.strictEqual(subscriptionStatus('something_new' as any), null);

  console.log('subscriptionStatus tests passed');
} catch (error) {
  console.error(error);
  process.exit(1);
}
