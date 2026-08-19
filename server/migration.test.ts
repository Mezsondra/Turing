// Registering must never cost a player the progress they built as a guest.
// Run: npx tsx server/migration.test.ts
import assert from 'assert';
import { unlinkSync } from 'fs';
import { DatabaseService } from './database/db.js';

const path = `./test-migration-${process.pid}.db`;
const db = new DatabaseService(path);

try {
  // A guest plays a few rounds and builds a streak.
  const guest = db.getOrCreateGuest('device-xyz', 'guest-1');
  db.recordGuess({ userId: guest.id, matchId: 'a', partnerType: 'AI', guess: 'AI', wasCorrect: true });
  db.recordGuess({ userId: guest.id, matchId: 'b', partnerType: 'AI', guess: 'AI', wasCorrect: true });

  const before = db.getUserById(guest.id)!;
  assert.strictEqual(before.score, 20);
  assert.strictEqual(before.current_streak, 2);

  // They sign up. Same row, same progress, now with an email.
  const claimed = db.attachAccountToGuest(guest.id, 'player@example.com', 'hashed', 'player');
  assert.ok(claimed, 'the guest row should be claimable');
  assert.strictEqual(claimed!.id, guest.id, 'the row id must not change');
  assert.strictEqual(claimed!.score, 20, 'score survives signup');
  assert.strictEqual(claimed!.current_streak, 2, 'streak survives signup');
  assert.strictEqual(claimed!.email, 'player@example.com');
  assert.strictEqual(db.getUserByEmail('player@example.com')!.id, guest.id);

  // The device row is now claimed: a second signup on it must not take it over.
  const stolen = db.attachAccountToGuest(guest.id, 'someone-else@example.com', 'hashed2');
  assert.strictEqual(stolen, undefined, 'an account row cannot be re-claimed');
  assert.strictEqual(db.getUserById(guest.id)!.email, 'player@example.com', 'owner unchanged');

  console.log('PASS: signing up keeps the guest row, score and streak');
} catch (error: any) {
  console.error('FAIL:', error.message);
  process.exitCode = 1;
} finally {
  db.close();
  for (const suffix of ['', '-shm', '-wal']) {
    try { unlinkSync(path + suffix); } catch {}
  }
}
