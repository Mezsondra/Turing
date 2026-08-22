import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

export interface Subscription {
  id: string;
  user_id: string;
  status: 'active' | 'canceled' | 'expired' | 'trialing';
  plan: 'free' | 'premium';
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  current_period_start?: number;
  current_period_end?: number;
  created_at: number;
  updated_at: number;
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

  constructor(dbPath: string = './turing.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize(): void {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    this.db.exec(schema);

    // Run migrations for existing databases
    this.runMigrations();

    console.log('Database initialized');
  }

  private runMigrations(): void {
    // Streak and deception columns, for databases created before they existed.
    for (const column of ['current_streak', 'best_streak', 'times_fooled']) {
      try {
        this.db.exec(`ALTER TABLE users ADD COLUMN ${column} INTEGER DEFAULT 0`);
      } catch {
        // Already present.
      }
    }

    // Guest identity column, for databases created before it existed.
    try {
      this.db.exec('ALTER TABLE users ADD COLUMN device_id TEXT');
      this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_device_id_unique ON users(device_id)');
    } catch {
      // Already present.
    }

    // Add score columns if they don't exist (for existing databases)
    try {
      this.db.exec(`
        ALTER TABLE users ADD COLUMN score INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN games_played INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN games_won INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN games_lost INTEGER DEFAULT 0;
      `);
      console.log('Score columns added to users table');
    } catch (error) {
      // Columns already exist, ignore error
    }
  }

  // User operations
  createUser(user: Omit<User, 'created_at' | 'updated_at' | 'score' | 'games_played' | 'games_won' | 'games_lost' | 'current_streak' | 'best_streak' | 'times_fooled'>): User {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, password_hash, username, score, games_played, games_won, games_lost, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, 0, 0, 0, ?, ?)
    `);

    stmt.run(user.id, user.email, user.password_hash, user.username || null, now, now);

    return {
      ...user,
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
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | undefined;
  }

  getUserByEmail(email: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) as User | undefined;
  }

  getUserByDeviceId(deviceId: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE device_id = ?');
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
    passwordHash: string,
    username?: string
  ): User | undefined {
    const result = this.db
      .prepare(
        `UPDATE users SET email = ?, password_hash = ?, username = COALESCE(?, username), updated_at = ?
         WHERE id = ? AND email IS NULL`
      )
      .run(email, passwordHash, username || null, Date.now(), userId);

    return result.changes === 1 ? this.getUserById(userId) : undefined;
  }

  /** Returns the existing player for this device, creating one on first sight. */
  getOrCreateGuest(deviceId: string, id: string): User {
    const existing = this.getUserByDeviceId(deviceId);
    if (existing) return existing;

    const now = Date.now();
    this.db
      .prepare(
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
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO game_sessions (id, user_id, partner_type, guess, was_correct, played_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const bumpScore = this.db.prepare(
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
    const awardDeception = this.db.prepare(
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

  // Subscription operations
  createSubscription(subscription: Omit<Subscription, 'created_at' | 'updated_at'>): Subscription {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO subscriptions (
        id, user_id, status, plan, stripe_subscription_id, stripe_customer_id,
        current_period_start, current_period_end, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      subscription.id,
      subscription.user_id,
      subscription.status,
      subscription.plan,
      subscription.stripe_subscription_id || null,
      subscription.stripe_customer_id || null,
      subscription.current_period_start || null,
      subscription.current_period_end || null,
      now,
      now
    );

    return { ...subscription, created_at: now, updated_at: now };
  }

  getSubscriptionByUserId(userId: string): Subscription | undefined {
    const stmt = this.db.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
    return stmt.get(userId) as Subscription | undefined;
  }

  updateSubscription(id: string, updates: Partial<Omit<Subscription, 'id' | 'user_id' | 'created_at'>>): void {
    const now = Date.now();
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), now, id];

    const stmt = this.db.prepare(`
      UPDATE subscriptions SET ${fields}, updated_at = ? WHERE id = ?
    `);

    stmt.run(...values);
  }

  // Game session operations
  createGameSession(session: Omit<GameSession, 'played_at'>): GameSession {
    const now = Date.now();
    const stmt = this.db.prepare(`
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
    const stmt = this.db.prepare('SELECT * FROM game_sessions WHERE id = ?');
    return stmt.get(id) as GameSession | undefined;
  }

  updateGameSession(id: string, guess: 'HUMAN' | 'AI', wasCorrect: boolean): void {
    const stmt = this.db.prepare(`
      UPDATE game_sessions SET guess = ?, was_correct = ? WHERE id = ?
    `);

    stmt.run(guess, wasCorrect ? 1 : 0, id);
  }

  getRecentGameCount(userId: string, limit: number = 5): number {
    const stmt = this.db.prepare(`
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
  getGameCountSince(userId: string, since: number): number {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM game_sessions WHERE user_id = ? AND played_at >= ?'
    );
    return (stmt.get(userId, since) as { count: number }).count;
  }

  getTotalGameCount(userId: string): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM game_sessions WHERE user_id = ?');
    const result = stmt.get(userId) as { count: number };
    return result.count;
  }

  getUserStats(userId: string): { total: number; correct: number; accuracy: number } {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN was_correct = 1 THEN 1 ELSE 0 END) as correct
      FROM game_sessions
      WHERE user_id = ?
    `);

    const result = stmt.get(userId) as { total: number; correct: number };
    const accuracy = result.total > 0 ? (result.correct / result.total) * 100 : 0;

    return { ...result, accuracy };
  }

  // --- Safety: reports, blocks, and account deletion ---

  createReport(report: {
    id: string;
    reporter_id: string;
    reported_id: string;
    match_id: string;
    reason: string;
    transcript?: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO reports (id, reporter_id, reported_id, match_id, reason, transcript, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        report.id,
        report.reporter_id,
        report.reported_id,
        report.match_id,
        report.reason,
        report.transcript || null,
        Date.now()
      );
  }

  getOpenReports(limit = 100): Array<Record<string, unknown>> {
    return this.db
      .prepare(`SELECT * FROM reports WHERE status = 'open' ORDER BY created_at DESC LIMIT ?`)
      .all(limit) as Array<Record<string, unknown>>;
  }

  setReportStatus(id: string, status: 'open' | 'reviewed' | 'actioned'): void {
    this.db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, id);
  }

  blockPlayer(blockerId: string, blockedId: string): void {
    this.db
      .prepare('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)')
      .run(blockerId, blockedId, Date.now());
  }

  /** True if either player has blocked the other - blocks apply both ways for matchmaking. */
  areBlocked(playerA: string, playerB: string): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 FROM blocks
         WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
         LIMIT 1`
      )
      .get(playerA, playerB, playerB, playerA);
    return Boolean(row);
  }

  /**
   * Permanently deletes a player and everything attached to them. Apple
   * requires in-app account deletion once an app offers accounts.
   * Reports filed *against* this player are kept, deliberately: they are
   * moderation records, and deleting an account must not erase evidence.
   */
  deleteUser(userId: string): void {
    const remove = this.db.transaction(() => {
      this.db.prepare('DELETE FROM game_sessions WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?').run(userId, userId);
      this.db.prepare('DELETE FROM reports WHERE reporter_id = ?').run(userId);
      this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    });
    remove();
  }

  close(): void {
    this.db.close();
  }
}

export const db = new DatabaseService();
