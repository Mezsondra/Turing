import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface User {
  id: string;
  email: string;
  password_hash: string;
  username?: string;
  score: number;
  games_played: number;
  games_won: number;
  games_lost: number;
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

class DatabaseService {
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
  createUser(user: Omit<User, 'created_at' | 'updated_at' | 'score' | 'games_played' | 'games_won' | 'games_lost'>): User {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, password_hash, username, score, games_played, games_won, games_lost, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, 0, 0, 0, ?, ?)
    `);

    stmt.run(user.id, user.email, user.password_hash, user.username || null, now, now);

    return { ...user, score: 0, games_played: 0, games_won: 0, games_lost: 0, created_at: now, updated_at: now };
  }

  getUserById(id: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | undefined;
  }

  getUserByEmail(email: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) as User | undefined;
  }

  updateUserScore(userId: string, won: boolean): void {
    const now = Date.now();
    const pointsChange = won ? 10 : -5; // +10 for correct guess, -5 for wrong guess

    const stmt = this.db.prepare(`
      UPDATE users
      SET score = score + ?,
          games_played = games_played + 1,
          games_won = games_won + ?,
          games_lost = games_lost + ?,
          updated_at = ?
      WHERE id = ?
    `);

    stmt.run(pointsChange, won ? 1 : 0, won ? 0 : 1, now, userId);
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

  close(): void {
    this.db.close();
  }
}

export const db = new DatabaseService();
