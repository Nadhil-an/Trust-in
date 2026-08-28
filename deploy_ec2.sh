#!/bin/bash
# =============================================================================
#  Sree Lakshmi Trust — EC2 Production Deployment Script
#  Run this once on a fresh EC2 Ubuntu server
#  Usage: bash deploy_ec2.sh
# =============================================================================

set -e  # Exit immediately on any error

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Sree Lakshmi Trust — EC2 Production Deployment        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Update system ─────────────────────────────────────────────
echo "📦 [1/7] Updating system packages..."
sudo apt-get update -qq && sudo apt-get upgrade -y -qq

# ── Step 2: Install Docker ────────────────────────────────────────────
echo "🐳 [2/7] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✅ Docker installed"
else
    echo "✅ Docker already installed"
fi

# Install Docker Compose plugin
if ! docker compose version &> /dev/null; then
    sudo apt-get install -y docker-compose-plugin
    echo "✅ Docker Compose installed"
else
    echo "✅ Docker Compose already installed"
fi

# ── Step 3: Project directory ─────────────────────────────────────────
echo "📁 [3/7] Setting up project directory..."
sudo mkdir -p /opt/sree-trust
sudo chown $USER:$USER /opt/sree-trust
echo "✅ Project directory ready at /opt/sree-trust"

# ── Step 4: Media directories ─────────────────────────────────────────
echo "📂 [4/7] Creating media directories..."
mkdir -p /opt/sree-trust/backend/media/donation_receipts
mkdir -p /opt/sree-trust/backend/media/membership_receipts
mkdir -p /opt/sree-trust/backend/media/hr
mkdir -p /opt/sree-trust/backend/whatsapp_gateway/auth_info_baileys
echo "✅ Media directories created"

# ── Step 5: Copy WhatsApp session ─────────────────────────────────────
echo ""
echo "🔑 [5/7] WhatsApp Session Transfer"
echo "   The WhatsApp session from your Windows PC must be copied to:"
echo "   /opt/sree-trust/backend/whatsapp_gateway/auth_info_baileys/"
echo ""
echo "   Run this command FROM YOUR WINDOWS PC (Git Bash or WSL):"
echo "   scp -r ./backend/whatsapp_gateway/auth_info_baileys/* ubuntu@<EC2_IP>:/opt/sree-trust/backend/whatsapp_gateway/auth_info_baileys/"
echo ""
read -p "   Press ENTER once you have transferred the auth_info_baileys folder..."

# ── Step 6: Environment file ──────────────────────────────────────────
echo ""
echo "⚙️  [6/7] Environment Configuration"
echo "   The .env file needs to be placed at: /opt/sree-trust/backend/.env"
echo ""
echo "   Key values to update for EC2:"
echo "   - ALLOWED_HOSTS → add your EC2 IP and domain"
echo "   - DATABASE_URL  → (left as-is, Docker Compose overrides with postgres)"
echo "   - CORS_ALLOWED_ORIGINS → add your domain"
echo "   - WHATSAPP_GATEWAY_URL=http://whatsapp-gateway:3001/send-message (already set)"
echo ""
if [ ! -f /opt/sree-trust/backend/.env ]; then
    echo "⚠️  .env file not found! Copy it now:"
    echo "   scp ./backend/.env ubuntu@<EC2_IP>:/opt/sree-trust/backend/.env"
    read -p "   Press ENTER once you have copied the .env file..."
fi

# ── Step 7: Start services ─────────────────────────────────────────────
echo ""
echo "🚀 [7/7] Starting all services with Docker Compose..."
cd /opt/sree-trust

# Build and start all containers
docker compose up -d --build

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 15

# Show status
docker compose ps

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   ✅ Deployment Complete!                                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Web Dashboard:       http://<EC2_IP>"
echo "📡 API:                 http://<EC2_IP>:8000/api/"
echo "📱 WhatsApp QR Page:    http://<EC2_IP>:3001/qr"
echo "📊 WhatsApp Status:     http://<EC2_IP>:3001/status"
echo ""
echo "📋 Useful commands:"
echo "   docker compose logs -f                         → View all logs"
echo "   docker compose logs -f whatsapp-gateway       → WhatsApp logs only"
echo "   docker compose restart whatsapp-gateway       → Restart WhatsApp gateway"
echo "   docker compose ps                             → Check service status"
echo ""
echo "⚠️  If WhatsApp needs re-scan: open http://<EC2_IP>:3001/qr in browser"
