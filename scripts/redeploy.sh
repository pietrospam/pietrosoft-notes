#!/bin/bash
set -e

# Configuration
PROD_HOST="root@192.168.100.113"
REMOTE_HOST="${DEPLOY_HOST:-$PROD_HOST}"
REMOTE_PATH="/opt/pietrosoft-notes"
LOCAL_PATH="$(dirname "$0")/.."
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

# Step 0: Clean up Docker resources on remote server
echo "🧹 Cleaning up Docker resources..."
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "docker system prune -af --volumes 2>/dev/null || true"
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "docker builder prune -af 2>/dev/null || true"

# Step 1: Clean up remote env files before syncing so excluded env files do not persist on the server.
echo "📄 Removing stale env files from remote server..."
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_PATH && rm -f .env.local .env.test .env.production .env"

# Step 1.2: Sync files to remote server (excluding node_modules, .next, etc)
echo "📦 Syncing files to remote server..."
# Exclude .env files from deploy to avoid accidentally shipping local/test env settings.
rsync -avz --delete --delete-excluded -e "ssh ${SSH_OPTS[*]}" \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude 'data/attachments/*' \
  --exclude '*.log' \
  --exclude '.env*' \
  "$LOCAL_PATH/" "$REMOTE_HOST:$REMOTE_PATH/"

# Step 1.3: Copy the target environment file explicitly
if [ "$REMOTE_HOST" = "$PROD_HOST" ]; then
  echo "📄 Copying production env file to remote server..."
  scp -o ControlMaster=no -o ControlPath="$CONTROL_SOCKET" -o ControlPersist=10m .env.production "$REMOTE_HOST:$REMOTE_PATH/.env"
else
  echo "📄 Copying test env file to remote server..."
  scp -o ControlMaster=no -o ControlPath="$CONTROL_SOCKET" -o ControlPersist=10m .env.test "$REMOTE_HOST:$REMOTE_PATH/.env"
fi

# Step 2: Rebuild and restart Docker containers on remote server
echo "🔧 Building and restarting Docker containers..."
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_PATH && docker compose down && APP_ENV=$APP_ENV docker compose build --no-cache && APP_ENV=$APP_ENV docker compose up -d"

# Step 3: Wait for containers and show logs
echo "⏳ Waiting for app to start..."
sleep 5
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_PATH && docker compose logs --tail=20 app"

# Step 4: Show status
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
