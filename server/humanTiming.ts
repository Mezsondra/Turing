/**
 * Makes the AI answer on a human clock.
 *
 * The old model was a flat 30ms per character, which works out at roughly 400
 * WPM - nearly twice the world record. Instant, evenly-paced replies are one of
 * the strongest bot tells there is, so this splits the delay the way a person
 * actually spends it: reading what you said, thinking, then typing at a speed
 * that stays constant for the whole conversation.
 */

/** Sustained human typing: phone ~3 c/s, quick desktop typist ~6.5 c/s. */
const MIN_CHARS_PER_SECOND = 3.0;
const MAX_CHARS_PER_SECOND = 6.5;

/** A very long reply must not swallow a 60 second round. */
const MAX_TYPING_MS = 8000;
const MIN_TYPING_MS = 600;
const MAX_READING_MS = 2500;

const speeds = new Map<string, number>();

/**
 * One typing speed per match. A real person does not type at 3 c/s on one
 * message and 6 c/s on the next, and that inconsistency is itself a tell.
 */
export function typingSpeedFor(matchId: string): number {
  let speed = speeds.get(matchId);
  if (speed === undefined) {
    speed = MIN_CHARS_PER_SECOND + Math.random() * (MAX_CHARS_PER_SECOND - MIN_CHARS_PER_SECOND);
    speeds.set(matchId, speed);
  }
  return speed;
}

export function forgetMatch(matchId: string): void {
  speeds.delete(matchId);
}

export interface Delays {
  /** Pause before the typing indicator appears: reading plus thinking. */
  preTypingMs: number;
  /** How long the typing indicator runs before the message lands. */
  typingMs: number;
}

export function computeDelays(options: {
  matchId: string;
  /** What the player sent, if anything. The opening message has none. */
  incomingText?: string;
  replyText: string;
  /** Time already spent waiting on the model, which counts as thinking time. */
  elapsedMs?: number;
  /** Extra pause when this person's attention wandered. */
  distractedMs?: number;
}): Delays {
  const { matchId, incomingText = '', replyText, elapsedMs = 0, distractedMs = 0 } = options;

  const readingMs = incomingText
    ? Math.min(MAX_READING_MS, 300 + incomingText.length * 25)
    : 0;
  const thinkingMs = 400 + Math.random() * 1400;

  // ±15% so the same speed does not produce suspiciously round timings.
  const jitter = 0.85 + Math.random() * 0.3;
  const typingMs = Math.min(
    MAX_TYPING_MS,
    Math.max(MIN_TYPING_MS, (replyText.length / typingSpeedFor(matchId)) * 1000 * jitter)
  );

  // The model call already kept them waiting; count it as thinking rather than
  // adding to it, or a slow provider turns into an unnatural silence.
  // Distraction is added on top: it is time spent away from the conversation,
  // not time the model was already thinking.
  const preTypingMs = Math.max(200, readingMs + thinkingMs - elapsedMs) + distractedMs;

  return { preTypingMs, typingMs };
}
