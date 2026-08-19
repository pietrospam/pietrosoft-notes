#!/bin/bash
set -euo pipefail

fatal() {
  echo "❌ $1" >&2
  exit 1
}

# Configuration
PROD_HOST="root@192.168.100.113"
REMOTE_HOST="${DEPLOY_HOST:-$PROD_HOST}"
REMOTE_PATH="${DEPLOY_PATH:-/opt/bitacora}"
BACKUP_HOST_DIR="/opt/bitacora-backups"
LOCAL_PATH="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_IP="${REMOTE_HOST#*@}"
CONTROL_SOCKET="/tmp/bitacora-${REMOTE_IP}.sock"
COMPOSE_PROJECT_NAME="bitacora"
DATABASE_NAME="bitacora"
SSH_OPTS=(-o ControlMaster=auto -o ControlPersist=10m -o ControlPath="$CONTROL_SOCKET")
POSTGRES_VOLUME_NAME="${DEPLOY_POSTGRES_VOLUME_NAME:-bitacora_postgres_data}"

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

echo "📁 Ensuring remote path exists..."
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "mkdir -p '$REMOTE_PATH'"

# Remove old containers from the legacy project name so bind conflicts (like 8080) do not block the new deployment.
echo "🧹 Removing legacy pietrosoft-notes containers from remote server..."
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "legacy_ids=\$(docker ps -aq --filter 'name=^pietrosoft-notes-' || true); if [ -n \"\$legacy_ids\" ]; then docker rm -f \$legacy_ids; fi"

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
  --exclude '/data' \
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

ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_PATH && if grep -q '^DATABASE_NAME=' .env; then sed -i 's#^DATABASE_NAME=.*#DATABASE_NAME=$DATABASE_NAME#' .env; else printf '\nDATABASE_NAME=%s\n' '$DATABASE_NAME' >> .env; fi"

# Step 4: Create the backup before replacing the app image. This is important
# for production databases that may not yet have the latest Prisma migrations.
echo "📁 Ensuring backups directory is writable by the app user..."
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "mkdir -p $BACKUP_HOST_DIR && chown -R 1000:1000 $BACKUP_HOST_DIR"

if [ "$REMOTE_HOST" = "$PROD_HOST" ]; then
  echo "📦 Creating a PostgreSQL backup before deploy..."
  backup_filename="backup-$(date -u +%Y-%m-%dT%H-%M-%S).sql.gz"
  remote_backup_path="$BACKUP_HOST_DIR/$backup_filename"
  ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd '$REMOTE_PATH' && (docker compose ps --services --status running 2>/dev/null | grep -qx postgres || COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME POSTGRES_VOLUME_NAME=$POSTGRES_VOLUME_NAME APP_ENV=$APP_ENV docker compose up -d postgres) && for i in \$(seq 1 30); do COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME POSTGRES_VOLUME_NAME=$POSTGRES_VOLUME_NAME docker compose exec -T postgres pg_isready -U postgres -d $DATABASE_NAME >/dev/null 2>&1 && break; if [ \$i -eq 30 ]; then echo '❌ postgres did not become ready in time'; exit 1; fi; sleep 2; done && tmp_backup=/tmp/$backup_filename.sql && COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME POSTGRES_VOLUME_NAME=$POSTGRES_VOLUME_NAME docker compose exec -T postgres pg_dump -U postgres -d $DATABASE_NAME --no-owner --no-privileges > \"\$tmp_backup\" && gzip -f \"\$tmp_backup\" && mv \"\$tmp_backup.gz\" '$remote_backup_path' && test -s '$remote_backup_path'" || fatal "Failed to create PostgreSQL backup. Aborting deploy."

  echo "📝 Remote backup filename: $backup_filename"
  mkdir -p "$LOCAL_PATH/backups"
  echo "⬇️ Downloading backup $backup_filename to local backups/..."
  scp -o ControlMaster=no -o ControlPath="$CONTROL_SOCKET" -o ControlPersist=10m "$REMOTE_HOST:$BACKUP_HOST_DIR/$backup_filename" "$LOCAL_PATH/backups/" || fatal "Failed to download backup file. Aborting deploy."
  echo "✅ Backup downloaded to $LOCAL_PATH/backups/$backup_filename"
fi

# Step 5: Clean up Docker resources on remote server
if [ "${DEPLOY_PRUNE:-0}" = "1" ]; then
  echo "🧹 Cleaning up Docker resources (DEPLOY_PRUNE=1)..."
  ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "docker system prune -af --volumes 2>/dev/null || true"
  ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "docker builder prune -af 2>/dev/null || true"
else
  echo "ℹ️ Skipping Docker prune (set DEPLOY_PRUNE=1 to enable)."
fi

# Step 6: Build the new image after the backup. On startup, start.sh runs
# `prisma migrate deploy` before the application starts.
echo "🔧 Building remote app image..."
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_PATH && COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME POSTGRES_VOLUME_NAME=$POSTGRES_VOLUME_NAME APP_ENV=$APP_ENV docker compose build app"

# Step 7: Restart Docker containers on remote server. For TEST, reset the
# named Postgres volume to clear stale crash data and avoid unhealthy loops.
echo "🔧 Restarting Docker containers..."
if [ "$REMOTE_HOST" != "$PROD_HOST" ]; then
  ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_PATH && COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME POSTGRES_VOLUME_NAME=$POSTGRES_VOLUME_NAME docker compose down -v || true && docker volume rm ${COMPOSE_PROJECT_NAME}_postgres_data 2>/dev/null || true && COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME POSTGRES_VOLUME_NAME=$POSTGRES_VOLUME_NAME APP_ENV=$APP_ENV docker compose up -d"
else
  ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_PATH && COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME POSTGRES_VOLUME_NAME=$POSTGRES_VOLUME_NAME docker compose down && COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME POSTGRES_VOLUME_NAME=$POSTGRES_VOLUME_NAME APP_ENV=$APP_ENV docker compose up -d"
fi

# Step 8: Wait for containers and show logs
echo "⏳ Waiting for app to start..."
sleep 5
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_PATH && COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME POSTGRES_VOLUME_NAME=$POSTGRES_VOLUME_NAME docker compose logs --tail=20 app"

# Step 9: Show status
echo "📊 Container status:"
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_PATH && COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME POSTGRES_VOLUME_NAME=$POSTGRES_VOLUME_NAME docker compose ps"

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
