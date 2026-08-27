import { createHmac, randomInt, timingSafeEqual } from 'crypto';

/**
 * One-time email sign-in codes. The decision logic is kept pure and separate
 * from delivery and storage so it can be tested without a mail provider or a
 * database, and so the rules that make a 6-digit secret safe are in one place.
 *
 * Six digits is only a million possibilities, so the cap on attempts is what
 * makes it safe, not the code length. Never raise MAX_ATTEMPTS without
 * lengthening the code.
 */
export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;

/** Uniform over 000000-999999. Leading zeros are kept; it is a string, not a number. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Salted by email, so one stolen hash cannot be replayed against another address. */
export function hashCode(code: string, email: string, secret: string): string {
  return createHmac('sha256', secret).update(`${email.toLowerCase()}:${code}`).digest('hex');
}

export interface StoredCode {
  code_hash: string;
  expires_at: number;
  attempts: number;
}

export type CodeCheck = 'ok' | 'expired' | 'locked' | 'wrong' | 'missing';

export function checkCode(
  stored: StoredCode | undefined,
  submitted: string,
  email: string,
  secret: string,
  now = Date.now(),
): CodeCheck {
  if (!stored) return 'missing';
  // Attempts are checked before expiry so a locked code cannot be probed by
  // waiting for it to lapse and asking again.
  if (stored.attempts >= MAX_ATTEMPTS) return 'locked';
  if (now > stored.expires_at) return 'expired';

  const expected = Buffer.from(stored.code_hash, 'hex');
  const actual = Buffer.from(hashCode(submitted, email, secret), 'hex');
  if (expected.length !== actual.length) return 'wrong';
  return timingSafeEqual(expected, actual) ? 'ok' : 'wrong';
}

/** Normalised so Foo@Gmail.com and foo@gmail.com are one account, not two. */
export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}
