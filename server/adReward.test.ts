// Rewarded-video SSV: the signature is the only thing standing between a
// forged HTTP request and free rounds.
// Run: npx tsx server/adReward.test.ts
import assert from 'assert';
import { createSign, generateKeyPairSync } from 'crypto';
import { verifyRewardCallback, signedContent } from './adReward.js';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const getKey = (keyId: string) => (keyId === '3335741209' ? pem : undefined);

const sign = (content: string): string =>
  createSign('SHA256').update(content).sign(privateKey, 'base64url');

const body =
  'ad_network=5450213213286189855&ad_unit=1234567890&custom_data=p-alice' +
  '&reward_amount=3&reward_item=rounds&timestamp=1788000000000' +
  '&transaction_id=abc123&user_id=u1&key_id=3335741209';
const query = `${body}&signature=${sign(body)}`;

try {
  // The signed content stops at &signature=, and must be taken verbatim from
  // the request: re-serialising the parsed params reorders them and the
  // signature stops matching.
  assert.strictEqual(signedContent(query), body);

  const ok = verifyRewardCallback(query, getKey);
  assert.ok(ok, 'a genuine callback verifies');
  assert.strictEqual(ok!.playerId, 'p-alice');
  assert.strictEqual(ok!.transactionId, 'abc123');
  assert.strictEqual(ok!.rewardAmount, 3);

  // Everything below is a forgery attempt and must grant nothing.
  assert.strictEqual(
    verifyRewardCallback(query.replace('custom_data=p-alice', 'custom_data=p-mallory'), getKey),
    null,
    'a swapped player id breaks the signature'
  );
  assert.strictEqual(
    verifyRewardCallback(query.replace('reward_amount=3', 'reward_amount=9999'), getKey),
    null,
    'inflating the reward breaks the signature'
  );
  assert.strictEqual(verifyRewardCallback(body, getKey), null, 'no signature, no reward');
  assert.strictEqual(
    verifyRewardCallback(`${body}&signature=not-a-signature`, getKey),
    null,
    'a garbage signature is rejected, not thrown on'
  );
  assert.strictEqual(
    verifyRewardCallback(query, () => undefined),
    null,
    'an unknown key id grants nothing'
  );
  assert.strictEqual(
    verifyRewardCallback(`${body}&signature=${sign('something else')}`, getKey),
    null,
    'a signature over other content is rejected'
  );

  // A negative or absurd amount must not become a negative round balance.
  const weird = 'custom_data=p-bob&reward_amount=-5&transaction_id=t2&key_id=3335741209';
  const weirdQuery = `${weird}&signature=${sign(weird)}`;
  assert.strictEqual(verifyRewardCallback(weirdQuery, getKey)!.rewardAmount, 0);

  console.log('PASS: only genuinely signed reward callbacks grant rounds');
} catch (error: any) {
  console.error('FAIL:', error.message);
  process.exitCode = 1;
}
