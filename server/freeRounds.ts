/**
 * How many free rounds a player has left.
 *
 * Kept pure and separate from index.ts so the rule that decides who pays can be
 * tested without booting a server. Every input is already resolved by the
 * caller; this function does no lookups and trusts nothing from the client.
 */
export interface FreeRoundCaps {
  /** Anonymous players, identified only by a browser-held device id. */
  guest: number;
  /** Signed-in accounts without a subscription. */
  member: number;
  /** Backstop across one IP, so wiping localStorage does not fully reset. */
  guestPerIp: number;
}

export interface RoundsLeftInput {
  /** Resolved server-side. Undefined means we could not identify the player. */
  playerId: string | undefined;
  /** Hashed, or null when the address is unavailable. */
  ipHash: string | null;
  isPremium: boolean;
  /** An account is a guest until it has an email on it. */
  isGuest: boolean;
  caps: FreeRoundCaps;
  /** Rounds this player has started, ever. */
  usedByPlayer: number;
  /** Rounds started from this IP by guests, ever. */
  usedByIp: number;
  /** Extra rounds earned by watching rewarded ads. */
  bonusRounds: number;
}

export function roundsLeft(input: RoundsLeftInput): number {
  // No identity, no play. This returned Infinity once, which meant a client
  // could simply omit its device id from the handshake and play forever.
  if (!input.playerId) return 0;

  if (input.isPremium) return Infinity;

  const cap = (input.isGuest ? input.caps.guest : input.caps.member) + input.bonusRounds;
  let left = Math.max(0, cap - input.usedByPlayer);

  // Guests only. A device id costs nothing to remint, so clearing site data
  // would otherwise hand out a fresh allowance on demand. Signed-in accounts
  // are never IP-capped: offices, campuses and households share one address,
  // and locking out a member because a flatmate played is worse than the
  // abuse it prevents.
  if (input.isGuest && input.ipHash) {
    // Bonus rounds lift this too, or a guest who watched three ads would still
    // be stopped by the backstop and get nothing for them.
    left = Math.min(
      left,
      Math.max(0, input.caps.guestPerIp + input.bonusRounds - input.usedByIp)
    );
  }

  return left;
}
