/**
 * Minimal filter for human-to-human messages.
 *
 * ponytail: wordlist match, not a classifier. It catches slurs and the most
 * obvious abuse and nothing subtler - a determined abuser routes around it in
 * seconds. It exists because app stores require *a* filtering mechanism
 * alongside report/block, not because a wordlist is good moderation.
 * Upgrade path: send flagged-or-random messages to an LLM moderation call and
 * act on the score. Do that before any significant launch, not after.
 */

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
