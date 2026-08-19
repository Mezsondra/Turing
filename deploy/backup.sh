#!/bin/sh
# Nightly SQLite backup. Add to root's crontab:
#   0 3 * * * /srv/turing/deploy/backup.sh
# Uses SQLite's own .backup because `cp` on a live WAL database can produce a
# torn file that looks fine until you need to restore it.
set -eu
DB=/srv/turing/turing.db
DEST=/var/backups/turing
mkdir -p "$DEST"
sqlite3 "$DB" ".backup '$DEST/turing-$(date +%F).db'"
find "$DEST" -name 'turing-*.db' -mtime +14 -delete
