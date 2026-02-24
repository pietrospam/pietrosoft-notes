#!/bin/bash
set -e

# Configuration
REMOTE_HOST="root@192.168.100.113"
REMOTE_PATH="/opt/pietrosoft-notes"
LOCAL_PATH="$(dirname "$0")/.."

echo "🚀 Starting redeploy to $REMOTE_HOST..."

# Step 1: Sync files to remote server (excluding node_modules, .next, etc)
echo "📦 Syncing files to remote server..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude 'data/attachments/*' \
  --exclude '*.log' \
  "$LOCAL_PATH/" "$REMOTE_HOST:$REMOTE_PATH/"

# Step 2: Rebuild and restart containers on remote server
echo "🔧 Building and restarting Docker containers..."
ssh "$REMOTE_HOST" "cd $REMOTE_PATH && docker compose down && docker compose build --no-cache && docker compose up -d"

# Step 3: Run database migrations
echo "🗃️  Running database migrations..."
ssh "$REMOTE_HOST" "cd $REMOTE_PATH && docker compose exec -T app npx prisma migrate deploy"

# Step 4: Show status
echo "📊 Container status:"
ssh "$REMOTE_HOST" "cd $REMOTE_PATH && docker compose ps"

echo ""
echo "✅ Redeploy complete! App available at http://192.168.100.113:3001"
