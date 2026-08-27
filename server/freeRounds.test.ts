// Run: npx tsx server/freeRounds.test.ts
import assert from 'assert';
import { roundsLeft, type FreeRoundCaps } from './freeRounds.js';

const caps: FreeRoundCaps = { guest: 5, member: 10, guestPerIp: 20 };
const base = { ipHash: 'ip', isPremium: false, isGuest: true, caps, usedByPlayer: 0, usedByIp: 0 };

try {
  // The hole this replaced: an unidentifiable client used to get Infinity, so
  // omitting deviceId from the socket handshake bought unlimited free rounds.
  assert.strictEqual(roundsLeft({ ...base, playerId: undefined }), 0, 'no identity must not play');

  // Tiers.
  assert.strictEqual(roundsLeft({ ...base, playerId: 'g' }), 5, 'guest starts with 5');
  assert.strictEqual(roundsLeft({ ...base, playerId: 'm', isGuest: false }), 10, 'member starts with 10');
  assert.strictEqual(
    roundsLeft({ ...base, playerId: 'p', isPremium: true, usedByPlayer: 9999 }),
    Infinity,
    'premium is never capped',
  );

  // Signing up has to be worth something, or the funnel has no first step.
  assert.ok(caps.member > caps.guest, 'member cap must exceed guest cap');

  // Spending down, and never below zero.
  assert.strictEqual(roundsLeft({ ...base, playerId: 'g', usedByPlayer: 4 }), 1);
  assert.strictEqual(roundsLeft({ ...base, playerId: 'g', usedByPlayer: 5 }), 0);
  assert.strictEqual(roundsLeft({ ...base, playerId: 'g', usedByPlayer: 99 }), 0, 'never negative');

  // The IP backstop: a fresh device id on an exhausted address gets nothing.
  assert.strictEqual(
    roundsLeft({ ...base, playerId: 'fresh-device', usedByPlayer: 0, usedByIp: 20 }),
    0,
    'reminting a device id must not beat the IP cap',
  );
  // ...but it only bites once the IP allowance is actually gone.
  assert.strictEqual(
    roundsLeft({ ...base, playerId: 'fresh-device', usedByPlayer: 0, usedByIp: 19 }),
    1,
    'IP cap is a ceiling, not a per-device penalty',
  );

  // A shared address must not lock out someone who signed up.
  assert.strictEqual(
    roundsLeft({ ...base, playerId: 'm', isGuest: false, usedByIp: 9999 }),
    10,
    'members are never IP-capped',
  );

  // No address (proxy stripped it, local socket): fall back to the device cap
  // rather than failing open to unlimited.
  assert.strictEqual(roundsLeft({ ...base, playerId: 'g', ipHash: null, usedByIp: 9999 }), 5);

  // An admin typing 0 into the panel means "nobody plays free", not "everybody".
  assert.strictEqual(
    roundsLeft({ ...base, playerId: 'g', caps: { ...caps, guest: 0 } }),
    0,
    'a zero cap must close the door, not open it',
  );

  console.log('freeRounds tests passed');
} catch (error) {
  console.error(error);
  process.exit(1);
}
