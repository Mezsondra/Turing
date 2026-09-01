-- Canonical post-migration schema. Runtime upgrades are implemented as
-- numbered migrations in migrations.ts; this file is a reference for operators.

CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL
);

CREATE TABLE users (
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

CREATE TABLE game_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_type TEXT NOT NULL CHECK(partner_type IN ('HUMAN', 'AI')),
  guess TEXT CHECK(guess IN ('HUMAN', 'AI')),
  was_correct INTEGER CHECK(was_correct IN (0, 1)),
  played_at INTEGER NOT NULL
);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT REFERENCES users(id) ON DELETE CASCADE,
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

CREATE TABLE blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK(blocker_id <> blocked_id)
);

CREATE TABLE reward_grants (
  transaction_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rounds INTEGER NOT NULL CHECK(rounds > 0),
  created_at INTEGER NOT NULL
);

CREATE TABLE banned_ips (ip_hash TEXT PRIMARY KEY, created_at INTEGER NOT NULL);

CREATE TABLE round_starts (
  match_id TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ip_hash TEXT,
  started_at INTEGER NOT NULL,
  PRIMARY KEY (match_id, user_id)
);

CREATE TABLE login_codes (
  email TEXT COLLATE NOCASE PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  created_at INTEGER NOT NULL
);

CREATE TABLE billing_entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entitlement_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  processed_at INTEGER NOT NULL,
  PRIMARY KEY(provider, event_id)
);

CREATE INDEX idx_game_sessions_user_played ON game_sessions(user_id, played_at DESC);
CREATE INDEX idx_reports_status_created ON reports(status, created_at DESC);
CREATE INDEX idx_reports_resolved ON reports(resolved_at) WHERE resolved_at IS NOT NULL;
CREATE INDEX idx_blocks_blocked_blocker ON blocks(blocked_id, blocker_id);
CREATE INDEX idx_reward_grants_player ON reward_grants(player_id);
CREATE INDEX idx_round_starts_user ON round_starts(user_id);
CREATE INDEX idx_round_starts_ip ON round_starts(ip_hash);
CREATE INDEX idx_login_codes_expires ON login_codes(expires_at);
CREATE INDEX idx_entitlements_lifetime ON billing_entitlements(user_id, kind, status);
CREATE INDEX idx_entitlements_expiring ON billing_entitlements(user_id, kind, current_period_end DESC, status);
CREATE INDEX idx_entitlements_stripe_customer
  ON billing_entitlements(user_id, provider, updated_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_entitlements_customer
  ON billing_entitlements(provider, customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_billing_events_user_time ON billing_events(user_id, occurred_at DESC);
