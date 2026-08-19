// Regression test for the "Searching… forever" bug: matches created by the
// AI-fallback timeout were never announced, so those players hung indefinitely.
// Run: npx tsx --env-file .env.local server/matchmaking.test.ts
import assert from 'assert';
import { matchmakingService } from './matchmaking.js';
import { adminConfigService } from './adminConfig.js';

const originalTimeout = adminConfigService.getMatchTimeoutMs();

async function run() {
  adminConfigService.setMatchTimeoutMs(1000);

  let notified = false;
  matchmakingService.onMatch(() => { notified = true; });
  matchmakingService.onMatchFailure(() => { notified = true; });

  matchmakingService.addToQueue({
    id: 'test-user',
    playerId: 'test-player',
    socketId: 'test-socket',
    language: 'en',
    joinedAt: Date.now(),
  });

  // Long enough to cover both paths: the immediate AI roll and the timeout
  // fallback. Either must reach a listener - the bug was that neither did.
  await new Promise((r) => setTimeout(r, 2500));

  assert.ok(notified, 'a queued player must be told the outcome, never left waiting');
  matchmakingService.removeUser('test-user');
}

run()
  .then(() => console.log('PASS: queued player is always notified'))
  .catch((err) => { console.error('FAIL:', err.message); process.exitCode = 1; })
  .finally(() => adminConfigService.setMatchTimeoutMs(originalTimeout));
