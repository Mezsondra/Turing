// Blocks, reports and account deletion - the app store compliance surface.
// Run: npx tsx server/safety.test.ts
import assert from 'assert';
import { unlinkSync } from 'fs';
import { DatabaseService } from './database/db.js';

const path = `./test-safety-${process.pid}.db`;
const db = new DatabaseService(path);

try {
  const alice = db.getOrCreateGuest('dev-alice', 'p-alice');
  const bob = db.getOrCreateGuest('dev-bob', 'p-bob');

  assert.strictEqual(db.areBlocked(alice.id, bob.id), false);

  // A block applies in both directions for matchmaking: the blocked player
  // must not be able to reach the blocker by queueing again.
  db.blockPlayer(alice.id, bob.id);
  assert.strictEqual(db.areBlocked(alice.id, bob.id), true);
  assert.strictEqual(db.areBlocked(bob.id, alice.id), true, 'blocks are symmetric for matching');

  // Blocking twice must not error.
  db.blockPlayer(alice.id, bob.id);

  db.createReport({
    id: 'r1', reporter_id: alice.id, reported_id: bob.id,
    match_id: 'm1', reason: 'harassment', transcript: 'user: hi\nmodel: ...',
  });
  assert.strictEqual(db.getOpenReports().length, 1);

  db.setReportStatus('r1', 'actioned');
  assert.strictEqual(db.getOpenReports().length, 0, 'actioned reports leave the queue');

  // Bans. The account check is the easy half; the IP half is what makes a ban
  // worth issuing at all, since a guest mints a new identity by clearing
  // localStorage.
  const carol = db.getOrCreateGuest('dev-carol', 'p-carol');
  assert.strictEqual(db.isBanned(carol.id, 'ip-carol'), false);

  db.recordRoundStart('m-ban', carol.id, 'ip-carol');
  db.setUserBanned(carol.id, true);
  assert.strictEqual(db.isBanned(carol.id, null), true, 'the account is banned');
  assert.strictEqual(
    db.isBanned('p-brand-new-guest', 'ip-carol'),
    true,
    'a fresh guest identity on the banned IP is still banned'
  );
  assert.strictEqual(db.isBanned('p-someone-else', 'ip-elsewhere'), false, 'nobody else is caught');

  // Deleting the account must not lift the ban: "delete account" is documented
  // in the privacy policy, so it would be a one-tap, discoverable evasion.
  db.deleteUser(carol.id);
  assert.strictEqual(
    db.isBanned('p-brand-new-guest', 'ip-carol'),
    true,
    'deleting a banned account does not lift the IP ban'
  );

  // A ban has to be liftable, or a misclick in the admin queue is permanent.
  const dave = db.getOrCreateGuest('dev-dave', 'p-dave');
  db.recordRoundStart('m-ban2', dave.id, 'ip-dave');
  db.setUserBanned(dave.id, true);
  assert.strictEqual(db.isBanned('p-other', 'ip-dave'), true);
  db.setUserBanned(dave.id, false);
  assert.strictEqual(db.isBanned(dave.id, 'ip-dave'), false, 'unbanning clears the IP too');

  // Deleting an account removes the player and their data...
  db.recordGuess({ userId: alice.id, matchId: 'm2', partnerType: 'AI', guess: 'AI', wasCorrect: true });
  db.deleteUser(alice.id);
  assert.strictEqual(db.getUserById(alice.id), undefined, 'user is gone');
  assert.strictEqual(db.getTotalGameCount(alice.id), 0, 'their game history is gone');
  assert.strictEqual(db.areBlocked(alice.id, bob.id), false, 'their blocks are gone');

  // ...but reports filed AGAINST them survive, because deleting an account
  // must not let someone erase the evidence of their own abuse.
  db.createReport({ id: 'r2', reporter_id: bob.id, reported_id: alice.id, match_id: 'm3', reason: 'hate_speech' });
  db.deleteUser(alice.id);
  assert.strictEqual(db.getOpenReports().length, 1, 'reports against a deleted user are retained');

  console.log('PASS: blocks are symmetric, bans survive deletion, reports persist');
} catch (error: any) {
  console.error('FAIL:', error.message);
  process.exitCode = 1;
} finally {
  db.close();
  for (const suffix of ['', '-shm', '-wal']) { try { unlinkSync(path + suffix); } catch {} }
}
