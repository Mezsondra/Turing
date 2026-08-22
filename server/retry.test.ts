// A flaky upstream must not end a player's round.
// Run: npx tsx server/retry.test.ts
import assert from 'assert';
import { withRetry } from './ai/retry.js';

async function run() {
  // Transient failures are retried until one succeeds.
  let calls = 0;
  const result = await withRetry(async () => {
    calls += 1;
    if (calls < 3) throw Object.assign(new Error('busy'), { status: 503 });
    return 'recovered';
  });
  assert.strictEqual(result, 'recovered');
  assert.strictEqual(calls, 3, 'should have retried twice before succeeding');

  // Permanent failures fail immediately - retrying a 404 just wastes the round.
  let permanentCalls = 0;
  await assert.rejects(
    withRetry(async () => {
      permanentCalls += 1;
      throw Object.assign(new Error('gone'), { status: 404 });
    })
  );
  assert.strictEqual(permanentCalls, 1, 'a 404 must not be retried');

  // Give up after the attempt budget rather than hanging forever.
  let alwaysBusy = 0;
  await assert.rejects(
    withRetry(async () => {
      alwaysBusy += 1;
      throw Object.assign(new Error('busy'), { status: 503 });
    }, 3)
  );
  assert.strictEqual(alwaysBusy, 3, 'bounded attempts');
}

run()
  .then(() => console.log('PASS: transient failures retry, permanent ones do not'))
  .catch((error) => { console.error('FAIL:', error.message); process.exitCode = 1; });
