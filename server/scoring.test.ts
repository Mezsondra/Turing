// Guards the scoring rules the leaderboard and any paid feature depend on:
// a guess scores exactly once, and a replayed guess is ignored.
// Run: npx tsx server/scoring.test.ts
import assert from 'assert';
import { unlinkSync } from 'fs';
import { DatabaseService, DECEPTION_BONUS } from './database/db.js';

const path = `./test-scoring-${process.pid}.db`;
const db = new DatabaseService(path);

try {
  const player = db.getOrCreateGuest('device-under-test', 'player-1');
  assert.strictEqual(player.score, 0, 'a new guest starts at zero');

  // Same device again must return the same row, not a second player.
  assert.strictEqual(db.getOrCreateGuest('device-under-test', 'player-2').id, player.id);

  const guess = { userId: player.id, matchId: 'match-1', partnerType: 'AI' as const, guess: 'AI' as const };

  assert.strictEqual(db.recordGuess({ ...guess, wasCorrect: true }).applied, true, 'first guess scores');
  assert.strictEqual(db.getUserById(player.id)!.score, 10);

  // Replaying the same match must not score again.
  assert.strictEqual(db.recordGuess({ ...guess, wasCorrect: true }).applied, false, 'replay is ignored');
  assert.strictEqual(db.getUserById(player.id)!.score, 10, 'score unchanged after replay');
  assert.strictEqual(db.getUserById(player.id)!.games_played, 1);

  // A wrong guess in a different match costs 5.
  db.recordGuess({ ...guess, matchId: 'match-2', guess: 'HUMAN', wasCorrect: false });
  const after = db.getUserById(player.id)!;
  assert.strictEqual(after.score, 5);
  assert.strictEqual(after.games_played, 2);
  assert.strictEqual(after.games_won, 1);
  assert.strictEqual(after.games_lost, 1);

  // Streaks: extend on a correct call, reset to zero on a wrong one.
  const streaker = db.getOrCreateGuest('streak-device', 'player-streak');
  const correct = { userId: streaker.id, partnerType: 'AI' as const, guess: 'AI' as const, wasCorrect: true };
  db.recordGuess({ ...correct, matchId: 'm1' });
  db.recordGuess({ ...correct, matchId: 'm2' });
  db.recordGuess({ ...correct, matchId: 'm3' });
  assert.strictEqual(db.getUserById(streaker.id)!.current_streak, 3, 'three in a row');
  assert.strictEqual(db.getUserById(streaker.id)!.best_streak, 3);

  db.recordGuess({ userId: streaker.id, matchId: 'm4', partnerType: 'AI', guess: 'HUMAN', wasCorrect: false });
  const broken = db.getUserById(streaker.id)!;
  assert.strictEqual(broken.current_streak, 0, 'a wrong guess resets the streak');
  assert.strictEqual(broken.best_streak, 3, 'best streak is remembered');

  // Reverse role: calling a real human a bot pays that human a bonus.
  const judge = db.getOrCreateGuest('judge-device', 'player-judge');
  const actor = db.getOrCreateGuest('actor-device', 'player-actor');
  const actorScoreBefore = db.getUserById(actor.id)!.score;

  const outcome = db.recordGuess({
    userId: judge.id,
    matchId: 'human-match',
    partnerType: 'HUMAN',
    guess: 'AI',           // the judge was fooled
    wasCorrect: false,
    partnerPlayerId: actor.id,
  });

  assert.strictEqual(outcome.fooledPartner, true);
  assert.strictEqual(db.getUserById(actor.id)!.score, actorScoreBefore + DECEPTION_BONUS);
  assert.strictEqual(db.getUserById(actor.id)!.times_fooled, 1);

  // Correctly identifying a human pays no deception bonus.
  const honest = db.recordGuess({
    userId: judge.id,
    matchId: 'human-match-2',
    partnerType: 'HUMAN',
    guess: 'HUMAN',
    wasCorrect: true,
    partnerPlayerId: actor.id,
  });
  assert.strictEqual(honest.fooledPartner, false);
  assert.strictEqual(db.getUserById(actor.id)!.times_fooled, 1, 'no bonus for being correctly identified');

  console.log('PASS: scoring, streaks and the deception bonus all behave');
} catch (error: any) {
  console.error('FAIL:', error.message);
  process.exitCode = 1;
} finally {
  db.close();
  for (const suffix of ['', '-shm', '-wal']) {
    try { unlinkSync(path + suffix); } catch {}
  }
}
