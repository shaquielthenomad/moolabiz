#!/bin/bash
BACKUP_DIR="/root/backups/db"
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y-%m-%d_%H%M)

# Backup hub DB
docker exec coolify-db pg_dump -U coolify -d moolabiz | gzip > "$BACKUP_DIR/moolabiz_${DATE}.sql.gz"

# Backup vendure DB
docker exec coolify-db pg_dump -U vendure -d vendure | gzip > "$BACKUP_DIR/vendure_${DATE}.sql.gz"

# Keep only last 7 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

echo "[$(date)] Backup complete: moolabiz_${DATE}.sql.gz, vendure_${DATE}.sql.gz"
