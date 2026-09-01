import Database from 'better-sqlite3';
import { createHash } from 'crypto';

interface Migration {
  version: number;
  name: string;
  signature: string;
  apply: (db: Database.Database) => void;
}

const hasTable = (db: Database.Database, table: string): boolean =>
  Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));

const columns = (db: Database.Database, table: string): Set<string> =>
  new Set((db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name));

const ensureColumn = (db: Database.Database, table: string, column: string, definition: string): boolean => {
  if (columns(db, table).has(column)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  return true;
};

/**
 * Bring every historical database shape up to the set of columns consumed by
 * the constrained rebuild. This migration intentionally contains no catches:
 * a real disk/schema error must stop startup rather than look like "already
 * migrated".
 */
const normalizeLegacySchema = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      device_id TEXT UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT,
      username TEXT UNIQUE,
      score INTEGER DEFAULT 0,
      games_played INTEGER DEFAULT 0,
      games_won INTEGER DEFAULT 0,
      games_lost INTEGER DEFAULT 0,
      current_streak INTEGER DEFAULT 0,
      best_streak INTEGER DEFAULT 0,
      times_fooled INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      banned_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      plan TEXT NOT NULL,
      stripe_subscription_id TEXT UNIQUE,
      stripe_customer_id TEXT,
      current_period_start INTEGER,
      current_period_end INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      source TEXT DEFAULT 'stripe'
    );
    CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      partner_type TEXT NOT NULL,
      guess TEXT,
      was_correct INTEGER,
      played_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT,
      reported_id TEXT NOT NULL,
      match_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      transcript TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blocks (
      blocker_id TEXT NOT NULL,
      blocked_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (blocker_id, blocked_id)
    );
    CREATE TABLE IF NOT EXISTS reward_grants (
      transaction_id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      rounds INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS banned_ips (
      ip_hash TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS round_starts (
      match_id TEXT NOT NULL,
      user_id TEXT,
      ip_hash TEXT,
      started_at INTEGER NOT NULL,
      PRIMARY KEY (match_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS login_codes (
      email TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);

  const addedGamesPlayed = ensureColumn(db, 'users', 'games_played', 'INTEGER DEFAULT 0');
  const addedGamesWon = ensureColumn(db, 'users', 'games_won', 'INTEGER DEFAULT 0');
  const addedGamesLost = ensureColumn(db, 'users', 'games_lost', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'users', 'device_id', 'TEXT');
  ensureColumn(db, 'users', 'email', 'TEXT');
  ensureColumn(db, 'users', 'password_hash', 'TEXT');
  ensureColumn(db, 'users', 'username', 'TEXT');
  ensureColumn(db, 'users', 'score', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'users', 'current_streak', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'users', 'best_streak', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'users', 'times_fooled', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'users', 'created_at', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'users', 'updated_at', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'users', 'banned_at', 'INTEGER');
  ensureColumn(db, 'subscriptions', 'source', "TEXT DEFAULT 'stripe'");
  ensureColumn(db, 'reports', 'status', "TEXT DEFAULT 'open'");
  ensureColumn(db, 'reports', 'transcript', 'TEXT');

  // A genuinely partial historical migration should recover counter truth from
  // the immutable sessions rather than treating every existing game as zero.
  if (addedGamesPlayed || addedGamesWon || addedGamesLost) {
    db.exec(`
      UPDATE users
         SET games_played = (SELECT COUNT(*) FROM game_sessions g WHERE g.user_id = users.id),
             games_won = (SELECT COUNT(*) FROM game_sessions g WHERE g.user_id = users.id AND g.was_correct = 1),
             games_lost = (SELECT COUNT(*) FROM game_sessions g WHERE g.user_id = users.id AND g.was_correct = 0)
    `);
  }
};

const repairRoundStarts = (db: Database.Database): void => {
  // The buggy backfill used game_sessions.id (`match:user`) while live billing
  // used the raw match id. Normalize only rows proven to correspond to a game
  // session, so an unrelated id containing a colon is never rewritten.
  db.exec(`
    DELETE FROM round_starts AS duplicate
     WHERE duplicate.user_id IS NOT NULL
       AND EXISTS (
         SELECT 1
           FROM game_sessions g
          WHERE g.id = duplicate.match_id
            AND g.user_id = duplicate.user_id
            AND g.id LIKE '%:' || g.user_id
            AND EXISTS (
              SELECT 1 FROM round_starts canonical
               WHERE canonical.match_id = substr(g.id, 1, length(g.id) - length(g.user_id) - 1)
                 AND canonical.user_id = g.user_id
            )
       );

    UPDATE round_starts AS legacy
       SET match_id = (
         SELECT substr(g.id, 1, length(g.id) - length(g.user_id) - 1)
           FROM game_sessions g
          WHERE g.id = legacy.match_id AND g.user_id = legacy.user_id
       )
     WHERE legacy.user_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM game_sessions g
          WHERE g.id = legacy.match_id
            AND g.user_id = legacy.user_id
            AND g.id LIKE '%:' || g.user_id
       );

    INSERT OR IGNORE INTO round_starts (match_id, user_id, ip_hash, started_at)
    SELECT substr(g.id, 1, length(g.id) - length(g.user_id) - 1), g.user_id, NULL, g.played_at
      FROM game_sessions g
     WHERE g.id LIKE '%:' || g.user_id;
  `);
};

const assertSafeLegacyBilling = (db: Database.Database): void => {
  const paid = db.prepare(`
    SELECT COUNT(*) AS count
      FROM subscriptions
     WHERE plan = 'premium'
        OR stripe_subscription_id IS NOT NULL
        OR stripe_customer_id IS NOT NULL
        OR COALESCE(source, 'stripe') <> 'stripe'
  `).get() as { count: number };
  if (paid.count > 0) {
    throw new Error(
      `Refusing billing migration: found ${paid.count} legacy paid/mobile subscription row(s). ` +
      'Restore the backup and migrate those entitlements explicitly.'
    );
  }
};

const assertNoEmailCollisions = (db: Database.Database): void => {
  const collision = db.prepare(`
    SELECT lower(trim(email)) AS email, COUNT(*) AS count
      FROM users
     WHERE email IS NOT NULL
     GROUP BY lower(trim(email))
    HAVING COUNT(*) > 1
     LIMIT 1
  `).get() as { email: string; count: number } | undefined;
  if (collision) {
    throw new Error(`Refusing email normalization: ${collision.count} accounts collide for ${collision.email}`);
  }
};

const rebuildConstrainedSchema = (db: Database.Database): void => {
  assertSafeLegacyBilling(db);
  assertNoEmailCollisions(db);
  repairRoundStarts(db);

  db.exec(`
    CREATE TABLE users_new (
      id TEXT PRIMARY KEY,
      device_id TEXT UNIQUE,
      email TEXT COLLATE NOCASE UNIQUE,
      password_hash TEXT,
      username TEXT UNIQUE,
      score INTEGER NOT NULL DEFAULT 0,
      games_played INTEGER NOT NULL DEFAULT 0 CHECK(games_played >= 0),
      games_won INTEGER NOT NULL DEFAULT 0 CHECK(games_won >= 0),
      games_lost INTEGER NOT NULL DEFAULT 0 CHECK(games_lost >= 0),
      current_streak INTEGER NOT NULL DEFAULT 0 CHECK(current_streak >= 0),
      best_streak INTEGER NOT NULL DEFAULT 0 CHECK(best_streak >= current_streak),
      times_fooled INTEGER NOT NULL DEFAULT 0 CHECK(times_fooled >= 0),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      banned_at INTEGER,
      CHECK(games_won + games_lost = games_played)
    );
    INSERT INTO users_new
    SELECT id, device_id, CASE WHEN email IS NULL THEN NULL ELSE lower(trim(email)) END,
           password_hash, username, COALESCE(score, 0), COALESCE(games_played, 0),
           COALESCE(games_won, 0), COALESCE(games_lost, 0), COALESCE(current_streak, 0),
           MAX(COALESCE(best_streak, 0), COALESCE(current_streak, 0)), COALESCE(times_fooled, 0),
           COALESCE(created_at, 0), COALESCE(updated_at, 0), banned_at
      FROM users;

    CREATE TABLE game_sessions_new (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users_new(id) ON DELETE CASCADE,
      partner_type TEXT NOT NULL CHECK(partner_type IN ('HUMAN', 'AI')),
      guess TEXT CHECK(guess IN ('HUMAN', 'AI')),
      was_correct INTEGER CHECK(was_correct IN (0, 1)),
      played_at INTEGER NOT NULL
    );
    INSERT INTO game_sessions_new SELECT id, user_id, partner_type, guess, was_correct, played_at FROM game_sessions;

    CREATE TABLE reports_new (
      id TEXT PRIMARY KEY,
      reporter_id TEXT REFERENCES users_new(id) ON DELETE CASCADE,
      source TEXT NOT NULL DEFAULT 'human' CHECK(source IN ('human', 'automated')),
      reported_id TEXT NOT NULL,
      match_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      transcript TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'reviewed', 'actioned')),
      created_at INTEGER NOT NULL,
      resolved_at INTEGER,
      CHECK((source = 'human' AND reporter_id IS NOT NULL) OR (source = 'automated' AND reporter_id IS NULL))
    );
    INSERT INTO reports_new
    SELECT id,
           CASE WHEN reporter_id = 'system' THEN NULL ELSE reporter_id END,
           CASE WHEN reporter_id = 'system' THEN 'automated' ELSE 'human' END,
           reported_id, match_id, reason, transcript, status, created_at,
           CASE WHEN status = 'open' THEN NULL ELSE CAST(strftime('%s','now') AS INTEGER) * 1000 END
      FROM reports;

    CREATE TABLE blocks_new (
      blocker_id TEXT NOT NULL REFERENCES users_new(id) ON DELETE CASCADE,
      blocked_id TEXT NOT NULL REFERENCES users_new(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (blocker_id, blocked_id),
      CHECK(blocker_id <> blocked_id)
    );
    INSERT INTO blocks_new SELECT blocker_id, blocked_id, created_at FROM blocks WHERE blocker_id <> blocked_id;

    CREATE TABLE reward_grants_new (
      transaction_id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES users_new(id) ON DELETE CASCADE,
      rounds INTEGER NOT NULL CHECK(rounds > 0),
      created_at INTEGER NOT NULL
    );
    INSERT INTO reward_grants_new
    SELECT transaction_id, player_id, rounds, created_at FROM reward_grants
     WHERE rounds > 0 AND EXISTS (SELECT 1 FROM users_new u WHERE u.id = reward_grants.player_id);

    CREATE TABLE round_starts_new (
      match_id TEXT NOT NULL,
      user_id TEXT REFERENCES users_new(id) ON DELETE SET NULL,
      ip_hash TEXT,
      started_at INTEGER NOT NULL,
      PRIMARY KEY (match_id, user_id)
    );
    INSERT INTO round_starts_new SELECT match_id, user_id, ip_hash, started_at FROM round_starts;

    CREATE TABLE login_codes_new (
      email TEXT COLLATE NOCASE PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
      created_at INTEGER NOT NULL
    );
    INSERT INTO login_codes_new
    SELECT lower(trim(email)), code_hash, expires_at, MAX(attempts, 0), created_at FROM login_codes;

    CREATE TABLE billing_entitlements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users_new(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK(provider IN ('stripe', 'revenuecat')),
      external_key TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('subscription', 'lifetime')),
      status TEXT NOT NULL CHECK(status IN ('active', 'trialing', 'expired', 'canceled', 'refunded')),
      customer_id TEXT,
      current_period_start INTEGER,
      current_period_end INTEGER,
      last_event_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(provider, external_key),
      CHECK(kind = 'lifetime' OR current_period_end IS NOT NULL)
    );
    CREATE TABLE billing_events (
      provider TEXT NOT NULL CHECK(provider IN ('stripe', 'revenuecat')),
      event_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users_new(id) ON DELETE CASCADE,
      entitlement_key TEXT NOT NULL,
      event_type TEXT NOT NULL,
      occurred_at INTEGER NOT NULL,
      processed_at INTEGER NOT NULL,
      PRIMARY KEY(provider, event_id)
    );

    DROP TABLE game_sessions;
    DROP TABLE reports;
    DROP TABLE blocks;
    DROP TABLE reward_grants;
    DROP TABLE round_starts;
    DROP TABLE login_codes;
    DROP TABLE subscriptions;
    DROP TABLE users;

    ALTER TABLE users_new RENAME TO users;
    ALTER TABLE game_sessions_new RENAME TO game_sessions;
    ALTER TABLE reports_new RENAME TO reports;
    ALTER TABLE blocks_new RENAME TO blocks;
    ALTER TABLE reward_grants_new RENAME TO reward_grants;
    ALTER TABLE round_starts_new RENAME TO round_starts;
    ALTER TABLE login_codes_new RENAME TO login_codes;

    CREATE INDEX idx_game_sessions_user_played ON game_sessions(user_id, played_at DESC);
    CREATE INDEX idx_reports_status_created ON reports(status, created_at DESC);
    CREATE INDEX idx_reports_resolved ON reports(resolved_at) WHERE resolved_at IS NOT NULL;
    CREATE INDEX idx_blocks_blocked_blocker ON blocks(blocked_id, blocker_id);
    CREATE INDEX idx_reward_grants_player ON reward_grants(player_id);
    CREATE INDEX idx_round_starts_user ON round_starts(user_id);
    CREATE INDEX idx_round_starts_ip ON round_starts(ip_hash);
    CREATE INDEX idx_login_codes_expires ON login_codes(expires_at);
    CREATE INDEX idx_entitlements_user_status_end ON billing_entitlements(user_id, status, current_period_end);
    CREATE INDEX idx_entitlements_customer ON billing_entitlements(provider, customer_id) WHERE customer_id IS NOT NULL;
    CREATE INDEX idx_billing_events_user_time ON billing_events(user_id, occurred_at DESC);
  `);
};

const migrations: Migration[] = [
  {
    version: 1,
    name: 'normalize_legacy_schema',
    signature: 'legacy-columns-v2',
    apply: normalizeLegacySchema,
  },
  {
    version: 2,
    name: 'constrained_schema_entitlements_and_round_repair',
    signature: 'constrained-schema-v4',
    apply: rebuildConstrainedSchema,
  },
  {
    version: 3,
    name: 'optimize_effective_entitlement_lookup',
    signature: 'effective-entitlement-indexes-v1',
    apply: (db) => db.exec(`
      DROP INDEX IF EXISTS idx_entitlements_user_status_end;
      CREATE INDEX idx_entitlements_lifetime
        ON billing_entitlements(user_id, kind, status);
      CREATE INDEX idx_entitlements_expiring
        ON billing_entitlements(user_id, kind, current_period_end DESC, status);
      CREATE INDEX idx_entitlements_stripe_customer
        ON billing_entitlements(user_id, provider, updated_at DESC)
        WHERE customer_id IS NOT NULL;
    `),
  },
];

const checksumFor = (migration: Migration): string =>
  createHash('sha256')
    .update(`${migration.version}:${migration.name}:${migration.signature}`)
    .digest('hex');

export const runMigrations = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);

  const applied = db.prepare('SELECT version, checksum FROM schema_migrations').all() as Array<{
    version: number;
    checksum: string;
  }>;
  const appliedByVersion = new Map(applied.map((row) => [row.version, row.checksum]));
  const knownVersions = new Set(migrations.map((migration) => migration.version));
  const unknown = applied.find((row) => !knownVersions.has(row.version));
  if (unknown) {
    throw new Error(`Database schema version ${unknown.version} is newer than this application`);
  }

  for (const migration of migrations) {
    const checksum = checksumFor(migration);
    const existing = appliedByVersion.get(migration.version);
    if (existing) {
      if (existing !== checksum) {
        throw new Error(`Migration ${migration.version} checksum mismatch; refusing to start`);
      }
      continue;
    }

    // Foreign keys must be disabled before BEGIN when tables are rebuilt. They
    // are re-enabled immediately and validated before this method returns.
    db.pragma('foreign_keys = OFF');
    db.exec('BEGIN IMMEDIATE');
    try {
      migration.apply(db);
      db.prepare(
        'INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)'
      ).run(migration.version, migration.name, checksum, Date.now());
      db.exec('COMMIT');
    } catch (error) {
      if (db.inTransaction) db.exec('ROLLBACK');
      db.pragma('foreign_keys = ON');
      throw error;
    }
    db.pragma('foreign_keys = ON');
  }

  const violations = db.pragma('foreign_key_check') as unknown[];
  if (violations.length > 0) {
    throw new Error(`Database migration left ${violations.length} foreign-key violation(s)`);
  }
};

export const latestMigrationVersion = migrations[migrations.length - 1].version;
