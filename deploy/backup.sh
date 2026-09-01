#!/bin/sh
# Nightly SQLite backup. Add to root's crontab:
#   0 3 * * * /sdc/turing/deploy/backup.sh
# Uses SQLite's own .backup because `cp` on a live WAL database can produce a
# torn file that looks fine until you need to restore it.
set -eu
DB=${DATABASE_PATH:-/sdc/turing/turing.db}
DEST=${BACKUP_DIR:-/var/backups/turing}
STAMP=$(date +%F)
TMP="$DEST/.turing-$STAMP-$$.db"
FINAL="$DEST/turing-$STAMP.db"

mkdir -p "$DEST"
trap 'rm -f "$TMP"' EXIT HUP INT TERM

sqlite3 "$DB" ".backup '$TMP'"
RESULT=$(sqlite3 "$TMP" 'PRAGMA integrity_check;')
if [ "$RESULT" != "ok" ]; then
  echo "Backup integrity check failed: $RESULT" >&2
  exit 1
fi

mv -f "$TMP" "$FINAL"
trap - EXIT HUP INT TERM
find "$DEST" -type f -name 'turing-*.db' -mtime +30 -delete
echo "Verified SQLite backup: $FINAL"
