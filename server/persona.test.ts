// Run: npx tsx server/persona.test.ts
import assert from 'assert';
import { personaFor, forgetPersona, noteIncoming, shouldIgnoreMessage, distractionPauseMs } from './persona.js';

try {
  // A persona is fixed for the life of a match: an opponent whose name or mood
  // changed mid-conversation would be an obvious tell.
  const first = personaFor('match-a');
  assert.strictEqual(personaFor('match-a').instruction, first.instruction, 'stable within a match');

  // Different matches get different people.
  const instructions = new Set<string>();
  for (let i = 0; i < 60; i++) instructions.add(personaFor(`m-${i}`).instruction);
  assert.ok(instructions.size > 45, `expected variety, got ${instructions.size} distinct personas in 60`);

  // The AI must NOT always open, or "who spoke first" identifies it every time.
  let opened = 0;
  for (let i = 0; i < 400; i++) {
    forgetPersona(`o-${i}`);
    if (personaFor(`o-${i}`).opensConversation) opened += 1;
  }
  const rate = opened / 400;
  assert.ok(rate > 0.35 && rate < 0.75, `opening rate ${rate} should be near a coin flip, never 0 or 1`);

  // Some opponents burst, some never do.
  const chances = new Set<number>();
  for (let i = 0; i < 100; i++) chances.add(personaFor(`b-${i}`).burstChance);
  assert.ok(chances.size > 1, 'burst behaviour varies between opponents');

  forgetPersona('match-a');
  assert.notStrictEqual(personaFor('match-a').instruction, first.instruction, 'reset when the match ends');

  // Ignoring is bounded: never the player's first message, and at most once,
  // or a "distracted" opponent turns into a broken one.
  let everIgnoredFirst = false;
  let maxIgnoresInOneMatch = 0;

  for (let i = 0; i < 300; i++) {
    const match = `ig-${i}`;
    forgetPersona(match);
    let ignores = 0;
    for (let turn = 0; turn < 8; turn++) {
      const index = noteIncoming(match);
      if (shouldIgnoreMessage(match, index)) {
        ignores += 1;
        if (index === 1) everIgnoredFirst = true;
      }
    }
    maxIgnoresInOneMatch = Math.max(maxIgnoresInOneMatch, ignores);
  }

  assert.strictEqual(everIgnoredFirst, false, 'the opening message is always answered');
  assert.ok(maxIgnoresInOneMatch <= 1, `at most one ignore per match, saw ${maxIgnoresInOneMatch}`);
  assert.strictEqual(maxIgnoresInOneMatch, 1, 'some matches do ignore a message');

  // Attentive opponents never ignore anything.
  const attentive = Array.from({ length: 200 }, (_, i) => {
    forgetPersona(`at-${i}`);
    return personaFor(`at-${i}`).ignoreChance;
  });
  assert.ok(attentive.some((c) => c === 0), 'some opponents always reply');
  assert.ok(attentive.some((c) => c > 0), 'some opponents are distractible');

  // Distraction pauses, when they happen, are long enough to read as human.
  const pauses = Array.from({ length: 400 }, (_, i) => distractionPauseMs(`ig-${i % 300}`)).filter(Boolean);
  assert.ok(pauses.length > 0, 'distraction happens sometimes');
  assert.ok(Math.min(...pauses) >= 4000 && Math.max(...pauses) <= 10000, 'pause is 4-10s');

  console.log('PASS: personas vary, the AI does not always open, and ignoring is bounded');
} catch (error: any) {
  console.error('FAIL:', error.message);
  process.exitCode = 1;
}
