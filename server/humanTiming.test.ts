// Run: npx tsx server/humanTiming.test.ts
import assert from 'assert';
import { computeDelays, typingSpeedFor, forgetMatch } from './humanTiming.js';

try {
  // Typing speed must stay in human range for realistic message lengths.
  for (const text of ['lol no', 'im not doing math for u', 'idk man i just got back from work tbh']) {
    const { typingMs } = computeDelays({ matchId: 'm1', replyText: text });
    const wpm = (text.length / (typingMs / 1000)) * 60 / 5;
    assert.ok(wpm < 120, `${text.length} chars typed at ${wpm.toFixed(0)} WPM - too fast`);
  }

  // A person types at one speed all conversation.
  const speed = typingSpeedFor('m1');
  assert.strictEqual(typingSpeedFor('m1'), speed, 'speed is stable within a match');
  assert.ok(speed >= 3 && speed <= 6.5, 'speed is in human range');

  // Longer replies take longer to type.
  const short = computeDelays({ matchId: 'm2', replyText: 'yeah' }).typingMs;
  const long = computeDelays({ matchId: 'm2', replyText: 'yeah i guess that makes sense to me' }).typingMs;
  assert.ok(long > short, 'longer text takes longer');

  // Reading time scales with what the player wrote.
  const brief = computeDelays({ matchId: 'm3', incomingText: 'hi', replyText: 'yo', elapsedMs: 0 });
  const wordy = computeDelays({
    matchId: 'm3',
    incomingText: 'hey so i was thinking about what you said earlier and honestly it seems weird',
    replyText: 'yo',
    elapsedMs: 0,
  });
  assert.ok(wordy.preTypingMs > brief.preTypingMs, 'a longer message takes longer to read');

  // Slow model responses are absorbed, not stacked on top.
  const fast = computeDelays({ matchId: 'm4', incomingText: 'hello there', replyText: 'hey', elapsedMs: 0 });
  const slow = computeDelays({ matchId: 'm4', incomingText: 'hello there', replyText: 'hey', elapsedMs: 3000 });
  assert.ok(slow.preTypingMs < fast.preTypingMs, 'API latency counts as thinking time');
  assert.ok(slow.preTypingMs >= 200, 'but there is always some pause');

  // A very long reply cannot eat the whole round.
  const huge = computeDelays({ matchId: 'm5', replyText: 'x'.repeat(2000) });
  assert.ok(huge.typingMs <= 8000, 'typing time is capped');

  forgetMatch('m1');
  assert.notStrictEqual(typingSpeedFor('m1'), speed, 'speed is reset when the match ends');

  console.log('PASS: replies land on a human clock');
} catch (error: any) {
  console.error('FAIL:', error.message);
  process.exitCode = 1;
}
