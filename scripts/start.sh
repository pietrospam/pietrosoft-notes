#!/bin/sh
set -e

# Ensure mounted workspace directories are writable by the node user.
if [ "$(id -u)" = '0' ]; then
  mkdir -p /data/attachments /backups /home/node/.npm
  chown -R node:node /data /backups /home/node/.npm || true
fi

echo "Running database migrations..."
./node_modules/prisma/build/index.js migrate deploy

echo "Starting server..."
if [ "$(id -u)" = '0' ]; then
  exec su-exec node node server.js
else
  exec node server.js
fi
