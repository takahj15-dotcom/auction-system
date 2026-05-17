#!/usr/bin/env bash
# auction-system バックアップスクリプト
#
# 配置先: /usr/local/bin/auction-backup.sh
# 権限:   chmod +x /usr/local/bin/auction-backup.sh
# 実行ユーザ: auction (sudo -u auction または crontab -u auction)
#
# cron 例 (毎日 23:00):
#   0 23 * * * /usr/local/bin/auction-backup.sh >> /var/log/auction-backup.log 2>&1
#
# 仕様参照: docs/spec/08-operations.md §8.17

set -euo pipefail

# ─── 設定 ─────────────────────────────────────────────────────
DB_PATH="${DB_PATH:-/var/lib/auction-system/data.sqlite}"
UPLOAD_DIR="${UPLOAD_DIR:-/var/lib/auction-system/uploads}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/auction-system}"
KEEP_GENERATIONS="${KEEP_GENERATIONS:-7}"

# ─── 事前チェック ──────────────────────────────────────────────
if [[ ! -f "$DB_PATH" ]]; then
  echo "[auction-backup] ERROR: DB file not found at $DB_PATH" >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "[auction-backup] ERROR: sqlite3 command not found (apt install sqlite3)" >&2
  exit 1
fi

# ─── スナップショット作成 ──────────────────────────────────────
timestamp="$(date +%Y%m%d-%H%M%S)"
dest="$BACKUP_ROOT/$timestamp"
mkdir -p "$dest"

echo "[auction-backup] $(date -Iseconds) start -> $dest"

# DB は sqlite3 .backup でホットコピー (WAL モードでもアプリ稼働中に整合性保てる)
sqlite3 "$DB_PATH" ".backup '$dest/data.sqlite'"

# uploads は rsync (ハードリンクで増分にしたい場合は --link-dest を活用)
if [[ -d "$UPLOAD_DIR" ]]; then
  rsync -a --delete "$UPLOAD_DIR/" "$dest/uploads/"
else
  echo "[auction-backup] WARN: upload dir $UPLOAD_DIR not found, skipping"
fi

# ─── ローテーション ───────────────────────────────────────────
# 新しい順に並べて先頭 KEEP_GENERATIONS 件以外を削除
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -rn \
  | awk -v keep="$KEEP_GENERATIONS" 'NR>keep {print $2}' \
  | xargs -r rm -rf

echo "[auction-backup] $(date -Iseconds) done"

# ─── オフサイト保管 (オプション) ─────────────────────────────
# S3 や別 VPS に転送したい場合は以下のような行を追加する:
#
#   aws s3 sync "$dest" "s3://your-bucket/auction-system/$timestamp/" --storage-class STANDARD_IA
#
# あるいは:
#
#   rsync -az --partial "$dest/" "backup@offsite.example.com:/backups/auction-system/$timestamp/"
