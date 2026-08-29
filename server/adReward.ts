/**
 * AdMob rewarded-video server-side verification (SSV).
 *
 * The reward is extra rounds, which is exactly the thing the paywall exists to
 * ration - so "the client says it watched an ad" is not evidence. AdMob calls
 * this server directly with a signed callback, and only that signature grants
 * anything.
 *
 * Google signs every query parameter up to but not including `&signature=`,
 * with ECDSA-SHA256 over one of the keys published at
 * https://www.gstatic.com/admob/reward/verifier-keys.json.
 * https://developers.google.com/admob/flutter/rewarded/ssv
 */
import { createVerify } from 'crypto';

const KEY_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';

export interface RewardCallback {
  transactionId: string;
  playerId: string;
  rewardAmount: number;
}

/**
 * The signed content is the raw query string up to `&signature=`. It must be
 * taken from the request line verbatim: re-serialising the parsed parameters
 * reorders and re-encodes them, and the signature then never matches.
 */
export function signedContent(rawQuery: string): string | null {
  const marker = rawQuery.indexOf('&signature=');
  if (marker === -1) return null;
  return rawQuery.slice(0, marker);
}

/**
 * Verifies a callback and returns what it grants, or null if it is not
 * genuine. `getKey` maps a key_id to its PEM so this stays offline-testable.
 */
export function verifyRewardCallback(
  rawQuery: string,
  getKey: (keyId: string) => string | undefined
): RewardCallback | null {
  const content = signedContent(rawQuery);
  if (!content) return null;

  const params = new URLSearchParams(rawQuery);
  const signature = params.get('signature');
  const keyId = params.get('key_id');
  const transactionId = params.get('transaction_id');
  // Either field can carry the player; custom_data is the one this app sets.
  const playerId = params.get('custom_data') || params.get('user_id');
  if (!signature || !keyId || !transactionId || !playerId) return null;

  const pem = getKey(keyId);
  if (!pem) return null;

  let ok = false;
  try {
    // Google's signature is base64url and DER-encoded, which is node's default
    // for EC keys - do not set dsaEncoding here.
    ok = createVerify('SHA256').update(content).verify(pem, signature, 'base64url');
  } catch {
    // A malformed key or signature is a failed verification, not a crash.
    return null;
  }
  if (!ok) return null;

  const rewardAmount = Number(params.get('reward_amount'));
  return {
    transactionId,
    playerId,
    // Never trust the amount to be sane: it arrives signed but is still a
    // number from a network, and it is about to become free rounds.
    rewardAmount: Number.isFinite(rewardAmount) ? Math.max(0, Math.floor(rewardAmount)) : 0,
  };
}

let cachedKeys: Map<string, string> | null = null;

/** Google rotates these, so a miss refetches once rather than failing shut. */
export async function loadVerifierKeys(force = false): Promise<Map<string, string>> {
  if (cachedKeys && !force) return cachedKeys;

  const response = await fetch(KEY_URL);
  if (!response.ok) throw new Error(`Verifier keys unavailable: ${response.status}`);

  const body = (await response.json()) as { keys: Array<{ keyId: number | string; pem: string }> };
  cachedKeys = new Map(body.keys.map((k) => [String(k.keyId), k.pem]));
  return cachedKeys;
}
