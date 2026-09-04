import assert from 'assert';
import Database from 'better-sqlite3';
import { unlinkSync } from 'fs';
import { DatabaseService, latestMigrationVersion } from './database/db.js';

const files: string[] = [];
const pathFor = (name: string): string => {
  const path = `./test-db-${name}-${process.pid}.db`;
  files.push(path);
  return path;
};

const legacyCore = (raw: Database.Database): void => {
  raw.exec(`
    CREATE TABLE users (
    id TEXT PRIMARY KEY, device_id TEXT UNIQUE, email TEXT UNIQUE,
    password_hash TEXT, username TEXT UNIQUE, score INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0, games_won INTEGER DEFAULT 0,
    games_lost INTEGER DEFAULT 0, current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0, times_fooled INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE game_sessions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, partner_type TEXT NOT NULL,
    guess TEXT, was_correct INTEGER, played_at INTEGER NOT NULL
  );
  CREATE TABLE round_starts (
    match_id TEXT NOT NULL, user_id TEXT, ip_hash TEXT, started_at INTEGER NOT NULL,
    PRIMARY KEY(match_id, user_id)
  );
  CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, status TEXT NOT NULL, plan TEXT NOT NULL,
    stripe_subscription_id TEXT UNIQUE, stripe_customer_id TEXT,
    current_period_start INTEGER, current_period_end INTEGER,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, source TEXT DEFAULT 'stripe'
    );
  `);
};

try {
  // Fresh databases are fully versioned and a restart cannot rebill a game.
  const freshPath = pathFor('fresh');
  let db = new DatabaseService(freshPath);
  const user = db.getOrCreateGuest('device-fresh', 'fresh-user');
  db.recordRoundStart('match-one', user.id, 'ip-one');
  db.recordGuess({
    userId: user.id, matchId: 'match-one', partnerType: 'AI', guess: 'AI', wasCorrect: true,
  });
  assert.strictEqual(db.getRoundStartCount(user.id), 1);
  db.close();
  db = new DatabaseService(freshPath);
  assert.strictEqual(db.getRoundStartCount(user.id), 1, 'restart must not duplicate a billed round');

  // The free-round allowance is a rolling window, so every total it is built
  // from has to honour `since`. A window opening in the future must see none
  // of them - miss the clause on any one and the daily cap silently becomes a
  // lifetime one again.
  const future = Date.now() + 60_000;
  db.grantRewardRounds('reward-one', user.id, 3);
  assert.strictEqual(db.getBonusRounds(user.id), 3);
  assert.strictEqual(db.getRoundStartCount(user.id, future), 0, 'player rounds are windowed');
  assert.strictEqual(db.getRoundStartCountByIp('ip-one', future), 0, 'ip rounds are windowed');
  assert.strictEqual(db.getBonusRounds(user.id, future), 0, 'ad rewards are windowed');
  db.close();

  let raw = new Database(freshPath, { readonly: true });
  assert.strictEqual(
    (raw.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as { version: number }).version,
    latestMigrationVersion,
  );
  assert.deepStrictEqual(raw.pragma('foreign_key_check'), []);
  raw.close();

  // Repair both forms of the old restart bug and remain idempotent.
  const duplicatePath = pathFor('duplicate-rounds');
  raw = new Database(duplicatePath);
  legacyCore(raw);
  raw.exec(`
    INSERT INTO users (id, device_id, created_at, updated_at) VALUES ('round-user', 'device-round', 1, 1);
    INSERT INTO game_sessions VALUES ('match-two:round-user', 'round-user', 'AI', 'AI', 1, 2);
    INSERT INTO round_starts VALUES ('match-two', 'round-user', 'ip-two', 1);
    INSERT INTO round_starts VALUES ('match-two:round-user', 'round-user', NULL, 2);
  `);
  raw.close();
  db = new DatabaseService(duplicatePath);
  assert.strictEqual(db.getRoundStartCount('round-user'), 1, 'canonical and buggy ids collapse to one row');
  db.close();
  db = new DatabaseService(duplicatePath);
  assert.strictEqual(db.getRoundStartCount('round-user'), 1, 'repair runs exactly once');
  db.close();

  // A database on which the old grouped ALTER stopped halfway still upgrades.
  const partialPath = pathFor('partial');
  raw = new Database(partialPath);
  raw.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, score INTEGER DEFAULT 0);
            INSERT INTO users VALUES ('partial-user', 'Mixed@Example.COM', 7);`);
  raw.close();
  db = new DatabaseService(partialPath);
  assert.strictEqual(db.getUserByEmail('mixed@example.com')?.email, 'mixed@example.com');
  assert.strictEqual(db.getUserById('partial-user')?.games_played, 0);
  assert.throws(
    () => db.createUser({ id: 'duplicate-email', email: 'MIXED@example.com' }),
    /UNIQUE constraint failed/,
  );
  db.close();

  // Unexpected legacy money stops before the destructive subscriptions drop.
  const paidPath = pathFor('paid-abort');
  raw = new Database(paidPath);
  legacyCore(raw);
  raw.exec(`
    INSERT INTO users (id, email, created_at, updated_at) VALUES ('paid-user', 'paid@example.com', 1, 1);
    INSERT INTO subscriptions
      (id, user_id, status, plan, stripe_subscription_id, created_at, updated_at)
    VALUES ('paid-row', 'paid-user', 'active', 'premium', 'sub_real', 1, 1);
  `);
  raw.close();
  assert.throws(() => new DatabaseService(paidPath), /Refusing billing migration/);
  raw = new Database(paidPath, { readonly: true });
  assert.strictEqual(
    (raw.prepare("SELECT COUNT(*) AS count FROM subscriptions WHERE id='paid-row'").get() as { count: number }).count,
    1,
    'failed migration leaves the paid source row intact',
  );
  raw.close();

  // Automated reports work without a fake system user; account deletion
  // cascades rewards and billing but retains evidence filed against the user.
  const behaviorPath = pathFor('behavior');
  db = new DatabaseService(behaviorPath);
  const target = db.getOrCreateGuest('device-target', 'target-user');
  const blockedCandidate = db.getOrCreateGuest('device-blocked', 'blocked-user');
  const allowedCandidate = db.getOrCreateGuest('device-allowed', 'allowed-user');
  db.blockPlayer(target.id, blockedCandidate.id);
  const blockedIds = db.getBlockedPlayerIds(target.id);
  const syntheticQueue = Array.from({ length: 10_000 }, (_, index) => ({
    playerId: index === 9_999 ? allowedCandidate.id : blockedCandidate.id,
  }));
  const benchmarkStarted = performance.now();
  const candidateIndex = syntheticQueue.findIndex((candidate) => !blockedIds.has(candidate.playerId));
  const benchmarkMs = performance.now() - benchmarkStarted;
  assert.strictEqual(candidateIndex, 9_999, 'large queue scan uses one preloaded block set');
  db.createReport({
    id: 'auto-report', reporter_id: null, source: 'automated', reported_id: target.id,
    match_id: 'reported-match', reason: 'auto:threat', transcript: 'unsafe message',
  });
  assert.strictEqual(db.getOpenReports().length, 1);
  assert.strictEqual(db.grantRewardRounds('reward-one', target.id, 3), true);

  const farFuture = Date.now() + 60_000;
  assert.strictEqual(db.applyBillingEvent({
    provider: 'stripe', eventId: 'stripe-life', eventType: 'checkout.session.completed',
    occurredAt: 100, userId: target.id, externalKey: 'pi-life', kind: 'lifetime', status: 'active',
    customerId: 'cus-one',
  }).applied, true);
  assert.strictEqual(db.isPremiumUser(target.id, farFuture), true);

  db.applyBillingEvent({
    provider: 'revenuecat', eventId: 'rc-buy', eventType: 'INITIAL_PURCHASE', occurredAt: 200,
    userId: target.id, externalKey: 'rc-original', kind: 'subscription', status: 'active',
    currentPeriodEnd: farFuture,
  });
  db.applyBillingEvent({
    provider: 'revenuecat', eventId: 'rc-expire', eventType: 'EXPIRATION', occurredAt: 300,
    userId: target.id, externalKey: 'rc-original', kind: 'subscription', status: 'expired',
    currentPeriodEnd: farFuture,
  });
  assert.strictEqual(db.isPremiumUser(target.id, farFuture), true, 'mobile expiry cannot revoke Stripe lifetime');
  assert.strictEqual(db.applyBillingEvent({
    provider: 'revenuecat', eventId: 'rc-expire', eventType: 'EXPIRATION', occurredAt: 300,
    userId: target.id, externalKey: 'rc-original', kind: 'subscription', status: 'expired',
    currentPeriodEnd: farFuture,
  }).duplicate, true);

  const timed = db.getOrCreateGuest('device-timed', 'timed-user');
  db.applyBillingEvent({
    provider: 'stripe', eventId: 'newer', eventType: 'customer.subscription.updated', occurredAt: 500,
    userId: timed.id, externalKey: 'sub-timed', kind: 'subscription', status: 'active',
    currentPeriodEnd: 1_000,
  });
  assert.strictEqual(db.applyBillingEvent({
    provider: 'stripe', eventId: 'older', eventType: 'customer.subscription.deleted', occurredAt: 400,
    userId: timed.id, externalKey: 'sub-timed', kind: 'subscription', status: 'expired',
    currentPeriodEnd: 1_000,
  }).stale, true);
  assert.strictEqual(db.isPremiumUser(timed.id, 999), true);
  assert.strictEqual(db.isPremiumUser(timed.id, 1_001), false, 'local expiry survives a missing terminal webhook');

  const mobileLifetime = db.getOrCreateGuest('device-mobile-life', 'mobile-life-user');
  db.applyBillingEvent({
    provider: 'revenuecat', eventId: 'mobile-life-buy', eventType: 'NON_RENEWING_PURCHASE',
    occurredAt: 600, userId: mobileLifetime.id, externalKey: 'mobile-life-original',
    kind: 'lifetime', status: 'active',
  });
  db.applyBillingEvent({
    provider: 'revenuecat', eventId: 'mobile-life-refund', eventType: 'REFUND', occurredAt: 700,
    userId: mobileLifetime.id, externalKey: 'mobile-life-original', kind: 'subscription', status: 'refunded',
  });
  assert.strictEqual(db.isPremiumUser(mobileLifetime.id), false, 'a lifetime refund preserves kind and revokes access');

  db.deleteUser(target.id);
  assert.strictEqual(db.getBonusRounds(target.id), 0);
  assert.strictEqual(db.getEntitlements(target.id).length, 0);
  assert.strictEqual(db.getOpenReports().length, 1, 'reports against a deleted account remain');

  db.setReportStatus('auto-report', 'reviewed');
  db.saveLoginCode('Old@Example.com', 'hash', 1);
  const cleanup = db.cleanupExpiredData(Date.now() + 366 * 24 * 60 * 60 * 1000);
  assert.strictEqual(cleanup.loginCodes, 1);
  assert.strictEqual(cleanup.reports, 1);
  db.close();

  raw = new Database(behaviorPath, { readonly: true });
  const plan = raw.prepare(
    "EXPLAIN QUERY PLAN SELECT 1 FROM game_sessions WHERE user_id=? ORDER BY played_at DESC LIMIT 5"
  ).all('timed-user') as Array<{ detail: string }>;
  assert.ok(plan.some((row) => row.detail.includes('idx_game_sessions_user_played')));
  assert.ok(!plan.some((row) => row.detail.includes('TEMP B-TREE')));
  const entitlementPlan = raw.prepare(`
    EXPLAIN QUERY PLAN SELECT * FROM billing_entitlements
     WHERE user_id=? AND kind='subscription' AND current_period_end>=?
       AND status IN ('active','trialing')
     ORDER BY current_period_end DESC LIMIT 1
  `).all('timed-user', 0) as Array<{ detail: string }>;
  assert.ok(entitlementPlan.some((row) => row.detail.includes('idx_entitlements_expiring')));
  assert.ok(!entitlementPlan.some((row) => row.detail.includes('TEMP B-TREE')));
  assert.deepStrictEqual(raw.pragma('foreign_key_check'), []);
  assert.strictEqual(raw.pragma('integrity_check', { simple: true }), 'ok');
  raw.close();

  console.log(
    `PASS: versioned migrations, billing isolation, retention and query plans ` +
    `(10k matchmaking scan ${benchmarkMs.toFixed(2)}ms)`,
  );
} catch (error: any) {
  console.error('FAIL:', error.message);
  process.exitCode = 1;
} finally {
  for (const path of files) {
    for (const suffix of ['', '-shm', '-wal']) {
      try { unlinkSync(path + suffix); } catch {}
    }
  }
}
