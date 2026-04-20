#!/usr/bin/env bash
# Deploy script for TrueNAS SCALE (10.11.11.5)
# Builds image locally for linux/amd64, streams it to TrueNAS, restarts container.
set -euo pipefail

REMOTE_HOST="admin@10.11.11.5"
REMOTE_DIR="/mnt/flash/docker/cyonmail"
LOCAL_APP_DIR="$(cd "$(dirname "$0")/app" && pwd)"

echo "==> Building image for linux/amd64..."
docker build --platform linux/amd64 -t cyonmail:latest "$LOCAL_APP_DIR"

echo "==> Shipping image to TrueNAS..."
docker save cyonmail:latest | ssh "$REMOTE_HOST" "sudo docker load"

echo "==> Restarting container..."
ssh "$REMOTE_HOST" "cd $REMOTE_DIR && sudo docker compose up -d --force-recreate"

echo "==> Deployed. Container status:"
ssh "$REMOTE_HOST" "cd $REMOTE_DIR && sudo docker compose ps"
