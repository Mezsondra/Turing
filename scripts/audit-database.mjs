import Database from 'better-sqlite3';
import path from 'path';

const preflight = process.argv.includes('--preflight');
const argument = process.argv.find((value) => !value.startsWith('--') && value !== process.argv[0] && value !== process.argv[1]);
const databasePath = path.resolve(argument || process.env.DATABASE_PATH || './turing.db');
const db = new Database(databasePath, { readonly: true, fileMustExist: true });

const hasTable = (name) => Boolean(
  db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)
);
const scalar = (sql) => Number(db.prepare(sql).get().count);

try {
  const integrity = db.pragma('integrity_check', { simple: true });
  const foreignKeyViolations = db.pragma('foreign_key_check').length;
  const emailCollisions = hasTable('users') ? scalar(`
    SELECT COUNT(*) AS count FROM (
      SELECT lower(trim(email)) FROM users WHERE email IS NOT NULL
      GROUP BY lower(trim(email)) HAVING COUNT(*) > 1
    )
  `) : 0;
  const counterMismatches = hasTable('users') ? scalar(`
    SELECT COUNT(*) AS count FROM users
     WHERE games_played IS NULL OR games_won IS NULL OR games_lost IS NULL
        OR games_played < 0 OR games_won < 0 OR games_lost < 0
        OR games_won + games_lost <> games_played
  `) : 0;
  const duplicateRoundRows = hasTable('round_starts') && hasTable('game_sessions') ? scalar(`
    SELECT COUNT(*) AS count FROM round_starts r
     WHERE r.user_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM game_sessions g
          WHERE g.id = r.match_id AND g.user_id = r.user_id AND g.id LIKE '%:' || g.user_id
       )
  `) : 0;
  const legacyPaidRows = hasTable('subscriptions') ? scalar(`
    SELECT COUNT(*) AS count FROM subscriptions
     WHERE plan='premium' OR stripe_subscription_id IS NOT NULL OR stripe_customer_id IS NOT NULL
        OR COALESCE(source, 'stripe') <> 'stripe'
  `) : 0;
  const schemaVersion = hasTable('schema_migrations')
    ? Number(db.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations').get().version)
    : 0;

  const result = {
    databasePath,
    mode: preflight ? 'preflight' : 'post-migration',
    integrity,
    foreignKeyViolations,
    emailCollisions,
    counterMismatches,
    duplicateRoundRows,
    legacyPaidRows,
    schemaVersion,
  };
  console.log(JSON.stringify(result, null, 2));

  const failed = integrity !== 'ok' || foreignKeyViolations > 0 || emailCollisions > 0 ||
    counterMismatches > 0 || duplicateRoundRows > 0 || legacyPaidRows > 0 ||
    (!preflight && schemaVersion < 3) || (!preflight && hasTable('subscriptions'));
  if (failed) process.exitCode = 1;
} finally {
  db.close();
}
