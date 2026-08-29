// Run: npx tsx server/moderation.test.ts
import assert from 'assert';
import { moderateMessage, parseVerdict } from './moderation.js';

try {
  // Ordinary chat, including mild profanity, must pass. This is a game about
  // sounding human; over-filtering would make every player read as a bot.
  for (const ok of ['hey whats up', 'lol that was damn funny', 'i think ur a bot ngl', 'im 24 btw']) {
    assert.strictEqual(moderateMessage(ok).allowed, true, `should allow: ${ok}`);
  }

  // Slurs are blocked, including simple character substitution.
  for (const bad of ['you are a f@ggot', 'thats ret@rded']) {
    assert.strictEqual(moderateMessage(bad).allowed, false, `should block: ${bad}`);
    assert.strictEqual(moderateMessage(bad).reason, 'abuse');
  }

  // Contact details are blocked: moving strangers off-platform is the main
  // abuse vector in anonymous chat.
  assert.strictEqual(moderateMessage('email me at a@b.com').reason, 'contact');
  assert.strictEqual(moderateMessage('call me 555 123 4567').reason, 'contact');

  // The classifier itself needs an API key, but the part that can silently go
  // wrong offline is reading the model's answer. A wrapped or chatty reply must
  // still land on the right category, and an unparseable one must never invent
  // a report against a player.
  assert.strictEqual(parseVerdict('none'), 'none');
  assert.strictEqual(parseVerdict('harassment'), 'harassment');
  assert.strictEqual(parseVerdict('**harassment**\n'), 'harassment');
  assert.strictEqual(parseVerdict('The message is threat.'), 'threat');
  assert.strictEqual(parseVerdict('Category: MINORS'), 'minors');
  assert.strictEqual(parseVerdict(''), 'none');
  assert.strictEqual(parseVerdict('I cannot help with that request'), 'none');

  console.log('PASS: filter blocks slurs and contact details, allows normal chat');
  console.log('PASS: classifier verdicts parse, unparseable replies stay clean');
} catch (error: any) {
  console.error('FAIL:', error.message);
  process.exitCode = 1;
}
