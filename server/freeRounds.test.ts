// Run: npx tsx server/freeRounds.test.ts
import assert from 'assert';
import { roundsLeft, windowStart, type FreeRoundCaps } from './freeRounds.js';

const caps: FreeRoundCaps = { guest: 5, member: 10, guestPerIp: 20 };
const base = {
  ipHash: 'ip', isPremium: false, isGuest: true, caps,
  usedByPlayer: 0, usedByIp: 0, bonusRounds: 0,
};

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

  // Rewarded video. An exhausted player who watches ads gets exactly what they
  // earned, and the balance still cannot go negative.
  assert.strictEqual(
    roundsLeft({ ...base, playerId: 'g', usedByPlayer: 5, bonusRounds: 3 }),
    3,
    'a spent guest gets back exactly what they watched'
  );
  assert.strictEqual(
    roundsLeft({ ...base, playerId: 'g', usedByPlayer: 7, bonusRounds: 3 }),
    1,
    'bonus rounds are spent like any other'
  );
  assert.strictEqual(
    roundsLeft({ ...base, playerId: 'g', usedByPlayer: 99, bonusRounds: 3 }),
    0,
    'still never negative'
  );
  // Without lifting the IP backstop too, a guest at the address cap would watch
  // ads and receive nothing for them.
  assert.strictEqual(
    roundsLeft({ ...base, playerId: 'g', usedByPlayer: 0, usedByIp: 20, bonusRounds: 2 }),
    2,
    'bonus rounds lift the IP backstop as well'
  );

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

  // --- The allowance window, which the admin panel sets in hours. ---
  const now = 1_000_000_000_000;
  const hour = 60 * 60 * 1000;

  assert.strictEqual(windowStart(24, now), now - 24 * hour, 'a day is a day');
  assert.strictEqual(windowStart(1, now), now - hour);

  // 0 is the lifetime cap this shipped with, and the only value that means
  // "no window" - every other unusable input falls back to the default.
  assert.strictEqual(windowStart(0, now), 0, '0 hours never resets');
  for (const bad of [undefined, null, '', 'abc', NaN, -5, Infinity]) {
    assert.strictEqual(
      windowStart(bad, now),
      now - 24 * hour,
      `a bad window (${String(bad)}) must fall back, never open up`,
    );
  }

  // The clock is not trusted to be past the epoch; a window wider than `now`
  // must not produce a negative timestamp that sorts oddly against started_at.
  assert.strictEqual(windowStart(100, hour), 0, 'window wider than the clock clamps to 0');

  console.log('freeRounds tests passed');
} catch (error) {
  console.error(error);
  process.exit(1);
}
