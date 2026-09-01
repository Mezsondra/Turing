# Production database rollout

Production is a single PM2 process in `/sdc/turing`. Run the first constrained
schema migration inside a maintenance window.

## Preflight on a copy

```sh
cd /sdc/turing
export DATABASE_PATH=/sdc/turing/turing.db
export BACKUP_DIR=/var/backups/turing
sh deploy/backup.sh
cp /var/backups/turing/turing-$(date +%F).db /tmp/turing-migration-candidate.db
node scripts/audit-database.mjs --preflight /tmp/turing-migration-candidate.db
DATABASE_PATH=/tmp/turing-migration-candidate.db NODE_ENV=production npm run db:migrate
DATABASE_PATH=/tmp/turing-migration-candidate.db npm run db:audit
```

Before the maintenance deployment, persist `NODE_ENV=production` and
`DATABASE_PATH=/sdc/turing/turing.db` in `/sdc/turing/.env.local`; the explicit
exports above protect the migration commands, while these values protect every
later PM2 restart.

The preflight intentionally fails if it finds a legacy premium, Stripe-customer,
or RevenueCat row. Do not bypass that check; restore/retain the backup and build
an explicit paid-row mapping instead.

## Maintenance deployment

```sh
cd /sdc/turing
pm2 stop turing
DATABASE_PATH=/sdc/turing/turing.db BACKUP_DIR=/var/backups/turing sh deploy/backup.sh
git pull
npm install
npm run build
DATABASE_PATH=/sdc/turing/turing.db NODE_ENV=production npm run db:migrate
DATABASE_PATH=/sdc/turing/turing.db npm run db:audit
pm2 start turing
pm2 logs turing --lines 100
```

Smoke-test guest identity, registration, one scored round, reports, bans,
effective subscription status, and account deletion. Restart once and confirm
the round count did not change.

Install the nightly backup with root's crontab:

```cron
0 3 * * * DATABASE_PATH=/sdc/turing/turing.db BACKUP_DIR=/var/backups/turing /sdc/turing/deploy/backup.sh
```

## Rollback

Stop PM2, preserve the failed database for diagnosis, restore the timestamped
pre-migration backup to `/sdc/turing/turing.db`, deploy the prior commit, run
`PRAGMA integrity_check` through `scripts/audit-database.mjs --preflight`, and
start the single PM2 process again.

Backups are intentionally local to this host. Host loss remains an accepted
risk until off-host storage or provider snapshots are enabled.
