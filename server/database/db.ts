import Database from 'better-sqlite3';
import { isAbsolute, resolve } from 'path';
import { runMigrations } from './migrations.js';
export { latestMigrationVersion } from './migrations.js';

export interface User {
  id: string;
  device_id?: string;
  email?: string;
  password_hash?: string;
  username?: string;
  score: number;
  games_played: number;
  games_won: number;
  games_lost: number;
  current_streak: number;
  best_streak: number;
  times_fooled: number;
  created_at: number;
  updated_at: number;
}

export type BillingProvider = 'stripe' | 'revenuecat';
export type BillingStatus = 'active' | 'trialing' | 'expired' | 'canceled' | 'refunded';
export type EntitlementKind = 'subscription' | 'lifetime';

export interface BillingEntitlement {
  id: string;
  user_id: string;
  provider: BillingProvider;
  external_key: string;
  kind: EntitlementKind;
  status: BillingStatus;
  customer_id?: string;
  current_period_start?: number;
  current_period_end?: number;
  last_event_at: number;
  created_at: number;
  updated_at: number;
}

/** Backward-compatible view returned to the existing HTTP/auth clients. */
export interface EffectiveSubscription {
  id: string;
  user_id: string;
  plan: 'free' | 'premium';
  status: 'active' | 'trialing';
  stripe_customer_id?: string;
  current_period_start?: number;
  current_period_end?: number;
  created_at: number;
  updated_at: number;
}

export interface BillingEventInput {
  provider: BillingProvider;
  eventId: string;
  eventType: string;
  occurredAt: number;
  userId: string;
  externalKey: string;
  kind: EntitlementKind;
  status: BillingStatus | null;
  customerId?: string | null;
  currentPeriodStart?: number | null;
  currentPeriodEnd?: number | null;
}

export interface GameSession {
  id: string;
  user_id: string;
  partner_type: 'HUMAN' | 'AI';
  guess?: 'HUMAN' | 'AI';
  was_correct?: number;
  played_at: number;
}

/** Points awarded for convincing a real human that you were a bot. */
export const DECEPTION_BONUS = 5;

export class DatabaseService {
  private db: Database.Database;
  private statements = new Map<string, Database.Statement>();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(dbPath: string = process.env.DATABASE_PATH || './turing.db') {
    if (process.env.NODE_ENV === 'production' && !isAbsolute(dbPath)) {
      throw new Error('DATABASE_PATH must be absolute when NODE_ENV=production');
    }
    const resolvedPath = dbPath === ':memory:' ? dbPath : resolve(dbPath);
    this.db = new Database(resolvedPath);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('journal_mode = WAL');
    // FULL keeps committed billing/scoring writes durable across an OS crash.
    this.db.pragma('synchronous = FULL');
    this.db.pragma('wal_autocheckpoint = 1000');
    try {
      this.initialize();
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  private initialize(): void {
    runMigrations(this.db);
    this.cleanupExpiredData();
    this.cleanupTimer = setInterval(() => this.cleanupExpiredData(), 24 * 60 * 60 * 1000);
    this.cleanupTimer.unref();
    console.log('Database initialized with versioned schema');
  }

  private statement(sql: string): Database.Statement {
    let statement = this.statements.get(sql);
    if (!statement) {
      statement = this.db.prepare(sql);
      this.statements.set(sql, statement);
    }
    return statement;
  }

  cleanupExpiredData(now = Date.now()): { loginCodes: number; reports: number } {
    const day = 24 * 60 * 60 * 1000;
    const year = 365 * day;
    const loginCodes = this.statement('DELETE FROM login_codes WHERE expires_at < ?').run(now - day).changes;
    const reports = this.statement(
      "DELETE FROM reports WHERE status <> 'open' AND resolved_at IS NOT NULL AND resolved_at < ?"
    ).run(now - year).changes;
    return { loginCodes, reports };
  }

  // User operations
  createUser(user: Omit<User, 'created_at' | 'updated_at' | 'score' | 'games_played' | 'games_won' | 'games_lost' | 'current_streak' | 'best_streak' | 'times_fooled'>): User {
    const now = Date.now();
    const email = user.email?.trim().toLowerCase();
    const stmt = this.statement(`
      INSERT INTO users (id, email, password_hash, username, score, games_played, games_won, games_lost, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, 0, 0, 0, ?, ?)
    `);

    stmt.run(user.id, email || null, user.password_hash || null, user.username || null, now, now);

    return {
      ...user,
      email,
      score: 0,
      games_played: 0,
      games_won: 0,
      games_lost: 0,
      current_streak: 0,
      best_streak: 0,
      times_fooled: 0,
      created_at: now,
      updated_at: now,
    };
  }

  getUserById(id: string): User | undefined {
    const stmt = this.statement('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | undefined;
  }

  getUserByEmail(email: string): User | undefined {
    const stmt = this.statement('SELECT * FROM users WHERE email = ?');
    return stmt.get(email.trim().toLowerCase()) as User | undefined;
  }

  getUserByDeviceId(deviceId: string): User | undefined {
    const stmt = this.statement('SELECT * FROM users WHERE device_id = ?');
    return stmt.get(deviceId) as User | undefined;
  }

  /**
   * Turns a guest row into a registered account, keeping its id - and therefore
   * its score, streak and history. Registering must never cost a player their
   * progress, which is exactly what creating a fresh row would do.
   * Returns undefined if the row is already claimed by an account.
   */
  attachAccountToGuest(
    userId: string,
    email: string,
    passwordHash: string | null,
    username?: string
  ): User | undefined {
    const result = this.statement(
        `UPDATE users SET email = ?, password_hash = ?, username = COALESCE(?, username), updated_at = ?
         WHERE id = ? AND email IS NULL`
      )
      .run(email.trim().toLowerCase(), passwordHash, username || null, Date.now(), userId);

    return result.changes === 1 ? this.getUserById(userId) : undefined;
  }

  /** Returns the existing player for this device, creating one on first sight. */
  getOrCreateGuest(deviceId: string, id: string): User {
    const existing = this.getUserByDeviceId(deviceId);
    if (existing) return existing;

    const now = Date.now();
    this.statement(
        `INSERT INTO users (id, device_id, score, games_played, games_won, games_lost, created_at, updated_at)
         VALUES (?, ?, 0, 0, 0, 0, ?, ?)`
      )
      .run(id, deviceId, now, now);

    return this.getUserById(id)!;
  }

  /**
   * Records one player's guess and applies every score effect in one
   * transaction:
   *  - the guesser gains 10 for a correct call, loses 5 for a wrong one
   *  - their streak extends or resets
   *  - if they were talking to a real human and called them a bot, that human
   *    fooled them, and earns a deception bonus
   *
   * The session id is `matchId:userId`, so a replayed or duplicated guess is
   * ignored by the primary key rather than scoring twice.
   */
  recordGuess(args: {
    userId: string;
    matchId: string;
    partnerType: 'HUMAN' | 'AI';
    guess: 'HUMAN' | 'AI';
    wasCorrect: boolean;
    /** The human partner's player id, when this was a human-vs-human match. */
    partnerPlayerId?: string;
  }): { applied: boolean; fooledPartner: boolean } {
    const insert = this.statement(
      `INSERT OR IGNORE INTO game_sessions (id, user_id, partner_type, guess, was_correct, played_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const bumpScore = this.statement(
      `UPDATE users
       SET score = score + ?,
           games_played = games_played + 1,
           games_won = games_won + ?,
           games_lost = games_lost + ?,
           current_streak = CASE WHEN ? = 1 THEN current_streak + 1 ELSE 0 END,
           best_streak = MAX(best_streak, CASE WHEN ? = 1 THEN current_streak + 1 ELSE 0 END),
           updated_at = ?
       WHERE id = ?`
    );
    const awardDeception = this.statement(
      `UPDATE users
       SET score = score + ${DECEPTION_BONUS}, times_fooled = times_fooled + 1, updated_at = ?
       WHERE id = ?`
    );

    // Their partner was human, and they called them a bot: the partner won that
    // exchange, whether or not they ever look at the result.
    const fooledPartner = args.partnerType === 'HUMAN' && args.guess === 'AI' && !!args.partnerPlayerId;

    const apply = this.db.transaction(() => {
      const now = Date.now();
      const result = insert.run(
        `${args.matchId}:${args.userId}`,
        args.userId,
        args.partnerType,
        args.guess,
        args.wasCorrect ? 1 : 0,
        now
      );
      if (result.changes === 0) return { applied: false, fooledPartner: false };

      const won = args.wasCorrect ? 1 : 0;
      bumpScore.run(args.wasCorrect ? 10 : -5, won, args.wasCorrect ? 0 : 1, won, won, now, args.userId);

      if (fooledPartner) {
        awardDeception.run(now, args.partnerPlayerId);
      }

      return { applied: true, fooledPartner };
    });

    return apply();
  }

  // --- Provider-specific billing entitlements ---

  applyBillingEvent(input: BillingEventInput): {
    applied: boolean;
    duplicate: boolean;
    stale: boolean;
  } {
    if (!input.eventId || !input.externalKey) {
      throw new Error('Billing events require stable event and entitlement identities');
    }
    if (
      input.kind === 'subscription' &&
      (input.status === 'active' || input.status === 'trialing') &&
      input.currentPeriodEnd == null
    ) {
      throw new Error('A subscription entitlement requires currentPeriodEnd');
    }

    const apply = this.db.transaction(() => {
      const now = Date.now();
      const event = this.statement(`
        INSERT OR IGNORE INTO billing_events
          (provider, event_id, user_id, entitlement_key, event_type, occurred_at, processed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.provider,
        input.eventId,
        input.userId,
        input.externalKey,
        input.eventType,
        input.occurredAt,
        now
      );
      if (event.changes === 0) return { applied: false, duplicate: true, stale: false };
      if (!input.status) return { applied: false, duplicate: false, stale: false };

      const existing = this.statement(
        'SELECT last_event_at, kind FROM billing_entitlements WHERE provider = ? AND external_key = ?'
      ).get(input.provider, input.externalKey) as {
        last_event_at: number;
        kind: EntitlementKind;
      } | undefined;
      if (existing && existing.last_event_at > input.occurredAt) {
        return { applied: false, duplicate: false, stale: true };
      }
      if (!existing && input.kind === 'subscription' && input.currentPeriodEnd == null) {
        // A terminal event may legitimately arrive after account data was
        // removed. Keep its idempotency record without inventing an entitlement.
        return { applied: false, duplicate: false, stale: false };
      }
      const effectiveKind = existing && !['active', 'trialing'].includes(input.status)
        ? existing.kind
        : input.kind;

      this.statement(`
        INSERT INTO billing_entitlements
          (id, user_id, provider, external_key, kind, status, customer_id,
           current_period_start, current_period_end, last_event_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider, external_key) DO UPDATE SET
          user_id = excluded.user_id,
          kind = excluded.kind,
          status = excluded.status,
          customer_id = COALESCE(excluded.customer_id, billing_entitlements.customer_id),
          current_period_start = COALESCE(excluded.current_period_start, billing_entitlements.current_period_start),
          current_period_end = CASE
            WHEN excluded.kind = 'lifetime' THEN NULL
            ELSE COALESCE(excluded.current_period_end, billing_entitlements.current_period_end)
          END,
          last_event_at = excluded.last_event_at,
          updated_at = excluded.updated_at
      `).run(
        `${input.provider}:${input.externalKey}`,
        input.userId,
        input.provider,
        input.externalKey,
        effectiveKind,
        input.status,
        input.customerId ?? null,
        input.currentPeriodStart ?? null,
        input.currentPeriodEnd ?? null,
        input.occurredAt,
        now,
        now
      );
      return { applied: true, duplicate: false, stale: false };
    });

    return apply();
  }

  getEntitlements(userId: string): BillingEntitlement[] {
    return this.statement(
      'SELECT * FROM billing_entitlements WHERE user_id = ? ORDER BY updated_at DESC'
    ).all(userId) as BillingEntitlement[];
  }

  isPremiumUser(userId: string, now = Date.now()): boolean {
    return Boolean(this.statement(`
      SELECT 1 FROM billing_entitlements
       WHERE user_id = ?
         AND status IN ('active', 'trialing')
         AND (kind = 'lifetime' OR current_period_end >= ?)
       LIMIT 1
    `).get(userId, now));
  }

  getStripeCustomerId(userId: string): string | undefined {
    const row = this.statement(`
      SELECT customer_id FROM billing_entitlements
       WHERE user_id = ? AND provider = 'stripe' AND customer_id IS NOT NULL
       ORDER BY updated_at DESC LIMIT 1
    `).get(userId) as { customer_id: string } | undefined;
    return row?.customer_id;
  }

  getSubscriptionByUserId(userId: string, now = Date.now()): EffectiveSubscription {
    const lifetime = this.statement(`
      SELECT * FROM billing_entitlements
       WHERE user_id = ?
         AND status IN ('active', 'trialing')
         AND kind = 'lifetime'
       LIMIT 1
    `).get(userId) as BillingEntitlement | undefined;
    const active = lifetime ?? this.statement(`
      SELECT * FROM billing_entitlements
       WHERE user_id = ?
         AND kind = 'subscription'
         AND current_period_end >= ?
         AND status IN ('active', 'trialing')
       ORDER BY current_period_end DESC
       LIMIT 1
    `).get(userId, now) as BillingEntitlement | undefined;

    if (!active) {
      return {
        id: `free:${userId}`,
        user_id: userId,
        plan: 'free',
        status: 'active',
        created_at: now,
        updated_at: now,
      };
    }

    return {
      id: active.id,
      user_id: userId,
      plan: 'premium',
      status: active.status === 'trialing' ? 'trialing' : 'active',
      stripe_customer_id: active.provider === 'stripe' ? active.customer_id : undefined,
      current_period_start: active.current_period_start,
      current_period_end: active.current_period_end,
      created_at: active.created_at,
      updated_at: active.updated_at,
    };
  }

  // Game session operations
  createGameSession(session: Omit<GameSession, 'played_at'>): GameSession {
    const now = Date.now();
    const stmt = this.statement(`
      INSERT INTO game_sessions (id, user_id, partner_type, guess, was_correct, played_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.user_id,
      session.partner_type,
      session.guess || null,
      session.was_correct !== undefined ? session.was_correct : null,
      now
    );

    return { ...session, played_at: now };
  }

  getGameSession(id: string): GameSession | undefined {
    const stmt = this.statement('SELECT * FROM game_sessions WHERE id = ?');
    return stmt.get(id) as GameSession | undefined;
  }

  updateGameSession(id: string, guess: 'HUMAN' | 'AI', wasCorrect: boolean): void {
    const stmt = this.statement(`
      UPDATE game_sessions SET guess = ?, was_correct = ? WHERE id = ?
    `);

    stmt.run(guess, wasCorrect ? 1 : 0, id);
  }

  getRecentGameCount(userId: string, limit: number = 5): number {
    const stmt = this.statement(`
      SELECT COUNT(*) as count FROM (
        SELECT 1 FROM game_sessions
        WHERE user_id = ?
        ORDER BY played_at DESC
        LIMIT ?
      )
    `);

    const result = stmt.get(userId, limit) as { count: number } | undefined;
    return result?.count ?? 0;
  }

  /** Rounds this player has completed since a given moment. Used for the daily cap. */
  // --- Email sign-in codes ---

  saveLoginCode(email: string, codeHash: string, expiresAt: number): void {
    this.statement(
        `INSERT INTO login_codes (email, code_hash, expires_at, attempts, created_at)
         VALUES (?, ?, ?, 0, ?)
         ON CONFLICT(email) DO UPDATE SET
           code_hash = excluded.code_hash,
           expires_at = excluded.expires_at,
           attempts = 0,
           created_at = excluded.created_at`
      )
      .run(email.trim().toLowerCase(), codeHash, expiresAt, Date.now());
  }

  getLoginCode(email: string): { code_hash: string; expires_at: number; attempts: number } | undefined {
    return this.statement('SELECT code_hash, expires_at, attempts FROM login_codes WHERE email = ?')
      .get(email.trim().toLowerCase()) as { code_hash: string; expires_at: number; attempts: number } | undefined;
  }

  bumpLoginAttempts(email: string): void {
    this.statement('UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?')
      .run(email.trim().toLowerCase());
  }

  /** Codes are single use: consumed on success, so a replay finds nothing. */
  clearLoginCode(email: string): void {
    this.statement('DELETE FROM login_codes WHERE email = ?').run(email.trim().toLowerCase());
  }


  // --- Free-round accounting ---

  /** Idempotent: a re-announced match must not bill the player twice. */
  recordRoundStart(matchId: string, userId: string, ipHash: string | null): void {
    this.statement(
        `INSERT OR IGNORE INTO round_starts (match_id, user_id, ip_hash, started_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(matchId, userId, ipHash, Date.now());
  }

  getRoundStartCount(userId: string): number {
    const row = this.statement('SELECT COUNT(*) as count FROM round_starts WHERE user_id = ?')
      .get(userId) as { count: number };
    return row.count;
  }

  getRoundStartCountByIp(ipHash: string): number {
    const row = this.statement('SELECT COUNT(*) as count FROM round_starts WHERE ip_hash = ?')
      .get(ipHash) as { count: number };
    return row.count;
  }

  getGameCountSince(userId: string, since: number): number {
    const stmt = this.statement(
      'SELECT COUNT(*) as count FROM game_sessions WHERE user_id = ? AND played_at >= ?'
    );
    return (stmt.get(userId, since) as { count: number }).count;
  }

  getTotalGameCount(userId: string): number {
    return this.getUserById(userId)?.games_played ?? 0;
  }

  getUserStats(userId: string): { total: number; correct: number; accuracy: number } {
    const user = this.getUserById(userId);
    const total = user?.games_played ?? 0;
    const correct = user?.games_won ?? 0;
    return { total, correct, accuracy: total > 0 ? (correct / total) * 100 : 0 };
  }

  // --- Safety: reports, blocks, and account deletion ---

  createReport(report: {
    id: string;
    reporter_id?: string | null;
    source?: 'human' | 'automated';
    reported_id: string;
    match_id: string;
    reason: string;
    transcript?: string;
  }): void {
    const source = report.source ?? 'human';
    this.statement(
        `INSERT INTO reports (id, reporter_id, source, reported_id, match_id, reason, transcript, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        report.id,
        report.reporter_id ?? null,
        source,
        report.reported_id,
        report.match_id,
        report.reason,
        report.transcript || null,
        Date.now()
      );
  }

  /** Returns false when this transaction was already credited. */
  grantRewardRounds(transactionId: string, playerId: string, rounds: number): boolean {
    const result = this.statement(
        `INSERT OR IGNORE INTO reward_grants (transaction_id, player_id, rounds, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(transactionId, playerId, rounds, Date.now());
    return result.changes > 0;
  }

  getBonusRounds(playerId: string): number {
    const row = this.statement('SELECT COALESCE(SUM(rounds), 0) AS total FROM reward_grants WHERE player_id = ?')
      .get(playerId) as { total: number };
    return row.total;
  }

  getReport(id: string): Record<string, unknown> | undefined {
    return this.statement('SELECT * FROM reports WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
  }

  /**
   * ponytail: unbanning clears every IP this player used, which also frees
   * anyone else banned from the same address. Households sharing an IP with two
   * separate abusers is not a case worth carrying code for; if it ever happens,
   * key banned_ips by user too.
   */
  setUserBanned(userId: string, banned: boolean): void {
    const apply = this.db.transaction(() => {
      this.statement('UPDATE users SET banned_at = ?, updated_at = ? WHERE id = ?')
        .run(banned ? Date.now() : null, Date.now(), userId);

      if (banned) {
        this.statement(
            `INSERT OR IGNORE INTO banned_ips (ip_hash, created_at)
             SELECT DISTINCT ip_hash, ? FROM round_starts
              WHERE user_id = ? AND ip_hash IS NOT NULL`
          )
          .run(Date.now(), userId);
      } else {
        this.statement(
            `DELETE FROM banned_ips WHERE ip_hash IN (
               SELECT ip_hash FROM round_starts WHERE user_id = ?
             )`
          )
          .run(userId);
      }
    });
    apply();
  }

  /**
   * Whether this player may play at all.
   *
   * Checked against the account *and* the hashed IP, because guest identity is
   * self-asserted: clearing localStorage mints a new device id, so an
   * account-only ban is evaded in seconds.
   *
   * ponytail: an IP ban catches the household, not the person - a phone on
   * mobile data walks straight past it, and a shared connection punishes the
   * innocent. It raises the cost of evasion from trivial to annoying, which is
   * the honest ceiling here. Device fingerprinting is the next rung and is not
   * worth it until bans are actually being evaded.
   */
  isBanned(playerId: string | null, ipHash: string | null): boolean {
    if (playerId) {
      const user = this.statement('SELECT 1 FROM users WHERE id = ? AND banned_at IS NOT NULL')
        .get(playerId);
      if (user) return true;
    }
    if (ipHash) {
      const banned = this.statement('SELECT 1 FROM banned_ips WHERE ip_hash = ?').get(ipHash);
      if (banned) return true;
    }
    return false;
  }

  getOpenReports(limit = 100): Array<Record<string, unknown>> {
    return this.statement(`SELECT * FROM reports WHERE status = 'open' ORDER BY created_at DESC LIMIT ?`)
      .all(limit) as Array<Record<string, unknown>>;
  }

  setReportStatus(id: string, status: 'open' | 'reviewed' | 'actioned'): void {
    this.statement(
      "UPDATE reports SET status = ?, resolved_at = CASE WHEN ? = 'open' THEN NULL ELSE ? END WHERE id = ?"
    ).run(status, status, Date.now(), id);
  }

  blockPlayer(blockerId: string, blockedId: string): void {
    this.statement('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)')
      .run(blockerId, blockedId, Date.now());
  }

  /** True if either player has blocked the other - blocks apply both ways for matchmaking. */
  areBlocked(playerA: string, playerB: string): boolean {
    const row = this.statement(
        `SELECT 1 FROM blocks
         WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
         LIMIT 1`
      )
      .get(playerA, playerB, playerB, playerA);
    return Boolean(row);
  }

  getBlockedPlayerIds(playerId: string): Set<string> {
    const rows = this.statement(`
      SELECT blocked_id AS player_id FROM blocks WHERE blocker_id = ?
      UNION
      SELECT blocker_id AS player_id FROM blocks WHERE blocked_id = ?
    `).all(playerId, playerId) as Array<{ player_id: string }>;
    return new Set(rows.map((row) => row.player_id));
  }

  /**
   * Permanently deletes a player and everything attached to them. Apple
   * requires in-app account deletion once an app offers accounts.
   * Reports filed *against* this player are kept, deliberately: they are
   * moderation records, and deleting an account must not erase evidence.
   */
  deleteUser(userId: string): void {
    const remove = this.db.transaction(() => {
      const user = this.getUserById(userId);
      if (user?.email) this.clearLoginCode(user.email);
      // Child tables cascade; round_starts uses SET NULL so the hashed IP ledger
      // still prevents account deletion from resetting a lifetime free cap.
      this.statement('DELETE FROM users WHERE id = ?').run(userId);
    });
    remove();
  }

  close(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.statements.clear();
    this.db.close();
  }
}

export const db = new DatabaseService();
