-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  -- Guests get a row keyed by device_id with no email/password, so scores and
  -- streaks persist without a signup. Registering later fills in the rest.
  device_id TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  username TEXT UNIQUE,
  score INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  games_lost INTEGER DEFAULT 0,
  -- Retention hooks: a run of correct guesses, and how often this player has
  -- convinced a human partner that they were a bot.
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  times_fooled INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active', 'canceled', 'expired', 'trialing')),
  plan TEXT NOT NULL CHECK(plan IN ('free', 'premium')),
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  current_period_start INTEGER,
  current_period_end INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Game sessions table (to track games played)
CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  partner_type TEXT NOT NULL CHECK(partner_type IN ('HUMAN', 'AI')),
  guess TEXT CHECK(guess IN ('HUMAN', 'AI')),
  was_correct INTEGER,
  played_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_played_at ON game_sessions(played_at);

-- Abuse reports. Required by app store UGC rules (Apple Guideline 1.2), which
-- expect a way to report content and a 24h response commitment.
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  reported_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  transcript TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'reviewed', 'actioned')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
);

-- One-way blocks: matchmaking must never pair these two again.
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id);
