#!/bin/bash
# =============================================================================
#  Sree Lakshmi Trust — EC2 Deep Cleanup & Redeploy Script
#  WARNING: This will delete ALL Docker containers, volumes, and images.
# =============================================================================

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Sree Lakshmi Trust — EC2 Deep Cleanup & Redeploy       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo "⚠️  WARNING: This will DESTROY your database and all Docker containers."
read -p "Are you absolutely sure you want to proceed? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Aborted."
    exit 1
fi

# ── Step 1: Stop and remove all containers ─────────────────────────────
echo "🧹 [1/5] Stopping and removing all Docker containers..."
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true

# ── Step 2: Remove all Docker volumes and networks ─────────────────────
echo "🗑️  [2/5] Wiping Docker volumes (deleting database!)..."
docker volume rm $(docker volume ls -q) 2>/dev/null || true
docker network prune -f

# ── Step 3: Remove old images to free up space ─────────────────────────
echo "💿 [3/5] Deleting old Docker images..."
docker rmi -f $(docker images -aq) 2>/dev/null || true
docker system prune -a --volumes -f

# ── Step 4: Pull latest code ───────────────────────────────────────────
echo "📥 [4/5] Pulling latest code from GitHub..."
# We use the current directory where the script is located
cd "$(dirname "$0")"
# Assuming the user has git setup here. Otherwise they will need to re-clone or scp.
if [ -d ".git" ]; then
    git fetch --all
    git reset --hard origin/main
    git pull origin main
else
    echo "⚠️  Not a git repository. You need to upload your fresh files here."
fi

# ── Step 5: Start fresh ────────────────────────────────────────────────
echo "🚀 [5/5] Rebuilding and starting from scratch..."
docker compose up -d --build

echo ""
echo "✅ EC2 has been completely cleaned and redeployed from scratch!"
echo "Check status with: docker compose ps"
