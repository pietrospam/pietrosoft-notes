#!/bin/bash
set -euo pipefail

fatal() {
  echo "❌ $1" >&2
  exit 1
}

# Configuration
PROD_HOST="root@192.168.100.113"
REMOTE_HOST="${DEPLOY_HOST:-$PROD_HOST}"
REMOTE_PATH="/opt/pietrosoft-notes"
BACKUP_HOST_DIR="/opt/bitacora-backups"
LOCAL_PATH="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_IP="${REMOTE_HOST#*@}"
CONTROL_SOCKET="/tmp/pietrosoft-notes-${REMOTE_IP}.sock"
SSH_OPTS=(-o ControlMaster=auto -o ControlPersist=10m -o ControlPath="$CONTROL_SOCKET")

if [ "$REMOTE_HOST" = "$PROD_HOST" ]; then
  APP_ENV=production
  echo "⚠️  ATENCION: estas por desplegar en PRODUCCION ($REMOTE_IP)."
  echo "⚠️  Este proceso puede wipear datos por los pasos de limpieza y recreacion de contenedores."
  read -r -p "Escribi OK para continuar con PRODUCCION: " PROD_CONFIRM_1
  if [ "$PROD_CONFIRM_1" != "OK" ]; then
    echo "❌ Deploy cancelado por el usuario."
    exit 1
  fi

  read -r -p "Confirmacion final. Escribi OK para continuar: " PROD_CONFIRM_2
  if [ "$PROD_CONFIRM_2" != "OK" ]; then
    echo "❌ Deploy cancelado por el usuario."
    exit 1
  fi
else
  APP_ENV=test
fi

echo "🚀 Starting redeploy to $REMOTE_HOST..."

# Reuse a single SSH connection for all remote operations in this run.
echo "🔐 Establishing SSH session..."
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "echo connected" >/dev/null
cleanup_ssh() {
  ssh "${SSH_OPTS[@]}" -O exit "$REMOTE_HOST" >/dev/null 2>&1 || true
}
trap cleanup_ssh EXIT

# Step 0: Determine environment file and sync code to remote server before backup
if [ "$REMOTE_HOST" = "$PROD_HOST" ]; then
  ENV_FILE=""
  if [ -f "$LOCAL_PATH/.env.production" ]; then
    ENV_FILE="$LOCAL_PATH/.env.production"
  elif [ -f "$LOCAL_PATH/.env" ]; then
    ENV_FILE="$LOCAL_PATH/.env"
  else
    fatal "No environment file found in $LOCAL_PATH. Expected .env.production or .env. Deploy must be run from the repo root with one of these files present."
  fi

  echo "📝 Using env file: $ENV_FILE"
fi

# Step 1: Clean up remote env files before syncing so excluded env files do not persist on the server.
echo "📄 Removing stale env files from remote server..."
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_PATH && rm -f .env.local .env.test .env.production .env"

# Step 2: Sync files to remote server (excluding node_modules, .next, etc)
echo "📦 Syncing files to remote server..."
# Exclude .env files from deploy to avoid accidentally shipping local/test env settings.
rsync -avz --delete --delete-excluded -e "ssh ${SSH_OPTS[*]}" \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude '/backups' \
  --exclude 'data/attachments/*' \
  --exclude '*.log' \
  --exclude '.env*' \
  "$LOCAL_PATH/" "$REMOTE_HOST:$REMOTE_PATH/"

# Step 3: Copy the target environment file explicitly
if [ "$REMOTE_HOST" = "$PROD_HOST" ]; then
  echo "📄 Copying production env file to remote server..."
  scp -o ControlMaster=no -o ControlPath="$CONTROL_SOCKET" -o ControlPersist=10m "$ENV_FILE" "$REMOTE_HOST:$REMOTE_PATH/.env"
else
  echo "📄 Copying test env file to remote server..."
  scp -o ControlMaster=no -o ControlPath="$CONTROL_SOCKET" -o ControlPersist=10m "$LOCAL_PATH/.env.test" "$REMOTE_HOST:$REMOTE_PATH/.env"
fi

# Step 4: Create the backup before replacing the app image. This is important
# for production databases that may not yet have the latest Prisma migrations.
echo "� Ensuring backups directory is writable by the app user..."
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "mkdir -p $BACKUP_HOST_DIR && chown -R 1000:1000 $BACKUP_HOST_DIR"

if [ "$REMOTE_HOST" = "$PROD_HOST" ]; then
  echo "�📦 Creating a PostgreSQL backup before deploy..."
  backup_filename="backup-$(date -u +%Y-%m-%dT%H-%M-%S).sql.gz"
  remote_backup_path="$BACKUP_HOST_DIR/$backup_filename"
  ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_PATH && tmp_backup=/tmp/$backup_filename.sql && docker compose exec -T postgres pg_dump -U postgres -d pietrosoft_notes --no-owner --no-privileges > \"\$tmp_backup\" && gzip -f \"\$tmp_backup\" && mv \"\$tmp_backup.gz\" \"$remote_backup_path\" && test -s \"$remote_backup_path\"" || fatal "Failed to create PostgreSQL backup. Aborting deploy."

  echo "📝 Remote backup filename: $backup_filename"
  mkdir -p "$LOCAL_PATH/backups"
  echo "⬇️ Downloading backup $backup_filename to local backups/..."
  scp -o ControlMaster=no -o ControlPath="$CONTROL_SOCKET" -o ControlPersist=10m "$REMOTE_HOST:$BACKUP_HOST_DIR/$backup_filename" "$LOCAL_PATH/backups/" || fatal "Failed to download backup file. Aborting deploy."
  echo "✅ Backup downloaded to $LOCAL_PATH/backups/$backup_filename"
fi

# Step 5: Build the new image after the backup. On startup, start.sh runs
# `prisma migrate deploy` before the application starts.
echo "🔧 Building remote app image..."
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_PATH && APP_ENV=$APP_ENV docker compose build app"

# Step 6: Clean up Docker resources on remote server
echo "🧹 Cleaning up Docker resources..."
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "docker system prune -af --volumes 2>/dev/null || true"
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "docker builder prune -af 2>/dev/null || true"

# Step 7: Restart Docker containers on remote server
echo "🔧 Restarting Docker containers..."
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_PATH && docker compose down && APP_ENV=$APP_ENV docker compose up -d"

# Step 8: Wait for containers and show logs
echo "⏳ Waiting for app to start..."
sleep 5
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_PATH && docker compose logs --tail=20 app"

# Step 9: Show status
echo "📊 Container status:"
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_PATH && docker compose ps"

echo ""
if [ "$REMOTE_HOST" = "$PROD_HOST" ]; then
  echo "✅ Redeploy complete! App available at:"
  echo "   http://$REMOTE_IP:3001"
  echo "   http://bitacora.pietrosoft.ddnsfree.com"
else
  echo "✅ Redeploy complete! App available at:"
  echo "   http://$REMOTE_IP:3001"
  echo "   http://test.bitacora.pietrosoft.ddnsfree.com"
fi
