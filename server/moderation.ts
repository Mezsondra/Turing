/**
 * Moderation for human-to-human messages, in two passes.
 *
 * 1. `moderateMessage` - a wordlist, checked before the message is delivered.
 *    Instant, so it can block; blunt, so it only catches the unambiguous.
 * 2. `classifyMessage` - an LLM, run after delivery, which files anything
 *    subtler into the moderation queue for a human.
 *
 * Neither alone is enough: the wordlist misses everything phrased carefully,
 * and the LLM is too slow to stand between a player and their partner.
 */

import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { adminConfigService } from './adminConfig.js';

// Kept deliberately short and severity-focused. Casual profanity is allowed:
// this is a game about sounding human, and scrubbing "damn" would hurt it.
const BLOCKED_PATTERNS: RegExp[] = [
  /\bn[i1!]gg(?:er|a)\b/i,
  /\bf[a@]gg?[o0]t\b/i,
  /\bk[i1]ke\b/i,
  /\btr[a@]nny\b/i,
  /\bret[a@]rd(?:ed)?\b/i,
  // Sexual content involving minors - zero tolerance, broad on purpose.
  /\b(?:child|kid|minor|underage|preteen)\s*(?:porn|sex|nude|nudes)\b/i,
  /\bcp\s+(?:porn|pics|videos)\b/i,
];

// Contact-sharing is a common vector for moving abuse off-platform.
const CONTACT_PATTERNS: RegExp[] = [
  /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i,
  /\b(?:\+?\d[\d\s-]{8,}\d)\b/,
];

export interface ModerationResult {
  allowed: boolean;
  reason?: 'abuse' | 'contact';
}

export function moderateMessage(text: string): ModerationResult {
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(text))) {
    return { allowed: false, reason: 'abuse' };
  }
  if (CONTACT_PATTERNS.some((pattern) => pattern.test(text))) {
    return { allowed: false, reason: 'contact' };
  }
  return { allowed: true };
}

/**
 * Second pass: an LLM classifier that runs *after* the message is delivered.
 *
 * The wordlist above stays the synchronous gate because it is instant. An LLM
 * call is 300-1500ms, and this is a game where reply timing is the entire tell
 * - blocking delivery on it would stall the chat and hand players a signal that
 * the app, not their partner, was thinking. So the classifier runs
 * fire-and-forget and files into the same moderation queue a player-filed
 * report goes to, where a human decides.
 *
 * ponytail: one call per human message, no retry, no dedupe. Cheap on flash
 * with 60-second rounds; batch a match's transcript at round end if the bill
 * shows up, and dedupe per match if the queue gets noisy.
 */

// Matches the default in ai/providerFactory.ts. Moderation deliberately does
// not follow the admin's model choice: a classifier wants the cheap fast model
// even when the opponent is running something bigger.
const MODERATION_MODEL = 'gemini-3.6-flash';

export type AbuseCategory = 'harassment' | 'sexual' | 'minors' | 'threat' | 'none';

const CATEGORIES: AbuseCategory[] = ['harassment', 'sexual', 'minors', 'threat', 'none'];

const CLASSIFIER_PROMPT = `You moderate a chat game where two strangers talk for about a minute. Players write in any language.

Reply with exactly one word from this list and nothing else:
harassment - slurs, hate speech, targeted degradation of a person or group
sexual - explicit sexual content or solicitation
minors - anything sexual involving someone under 18
threat - threats of violence, or encouraging suicide or self-harm
none - everything else

Casual profanity, insults traded in fun, rudeness and arguing are "none". Only
flag what would get an app removed from a store.

Message: `;

/**
 * Pull the verdict out of whatever the model actually said. Models wrap the
 * answer ("**harassment**", "The message is harassment.") often enough that
 * taking the first word is wrong; take the first category word instead.
 * Anything unrecognised is 'none' - an unparseable reply must not become a
 * report against a player.
 */
export function parseVerdict(raw: string): AbuseCategory {
  const hit = raw
    .toLowerCase()
    .split(/[^a-z]+/)
    .find((word) => (CATEGORIES as string[]).includes(word));
  return (hit as AbuseCategory) || 'none';
}

export async function classifyMessage(text: string): Promise<AbuseCategory> {
  const apiKey = adminConfigService.getGeminiApiKey() || process.env.GEMINI_API_KEY;
  // No key configured: the wordlist is the whole filter. Say so loudly at the
  // call site rather than silently pretending every message is clean.
  if (!apiKey) return 'none';

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODERATION_MODEL,
    contents: CLASSIFIER_PROMPT + text.slice(0, 1000),
    config: {
      temperature: 0,
      // Without this the classifier refuses to read the very messages it exists
      // to catch, returns nothing, and every verdict silently becomes 'none'.
      safetySettings: [
        HarmCategory.HARM_CATEGORY_HARASSMENT,
        HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      ].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_NONE })),
    },
  });

  return parseVerdict(response.text ?? '');
}
