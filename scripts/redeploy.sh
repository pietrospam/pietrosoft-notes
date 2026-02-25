#!/bin/bash
set -e

# Configuration
REMOTE_HOST="root@192.168.100.113"
REMOTE_PATH="/opt/pietrosoft-notes"
LOCAL_PATH="$(dirname "$0")/.."

echo "🚀 Starting redeploy to $REMOTE_HOST..."

# Step 0: Clean up Docker resources on remote server
echo "🧹 Cleaning up Docker resources..."
ssh "$REMOTE_HOST" "docker system prune -af --volumes 2>/dev/null || true"
ssh "$REMOTE_HOST" "docker builder prune -af 2>/dev/null || true"

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

# Step 3: Wait for containers and show logs
echo "⏳ Waiting for app to start..."
sleep 5
ssh "$REMOTE_HOST" "cd $REMOTE_PATH && docker compose logs --tail=20 app"

# Step 4: Show status
echo "📊 Container status:"
ssh "$REMOTE_HOST" "cd $REMOTE_PATH && docker compose ps"

echo ""
echo "✅ Redeploy complete! App available at http://192.168.100.113:3001"
