#!/bin/bash
# =============================================================================
# Zaytri — GCE Server Setup Script
# Run this on the VM after uploading code to /home/clawtbot/projects/zaytri
# Usage: sudo bash scripts/setup-server.sh
# =============================================================================
set -e

DOMAIN="zaytri.abhishekthatguy.in"
EMAIL="clawtbot@gmail.com"
PROJECT_DIR="/home/clawtbot/projects/zaytri"

echo "══════════════════════════════════════════════════════════════"
echo "  Zaytri — Server Setup (asia-south1-a / e2-medium)"
echo "══════════════════════════════════════════════════════════════"

# ─── 1. Install Docker (if not present) ─────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    apt update && apt upgrade -y
    apt install -y docker.io docker-compose-v2 certbot
    systemctl enable docker
    systemctl start docker
    usermod -aG docker clawtbot
else
    echo "📦 Docker already installed"
fi

if ! command -v certbot &> /dev/null; then
    echo "📦 Installing Certbot..."
    apt install -y certbot
fi

# ─── 2. Create self-signed placeholder certs ────────────────────────────
echo "🔐 Creating placeholder SSL certificates..."
mkdir -p "$PROJECT_DIR/nginx/ssl"
if [ ! -f "$PROJECT_DIR/nginx/ssl/fullchain.pem" ] || [ ! -s "$PROJECT_DIR/nginx/ssl/fullchain.pem" ]; then
    openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
        -keyout "$PROJECT_DIR/nginx/ssl/privkey.pem" \
        -out "$PROJECT_DIR/nginx/ssl/fullchain.pem" \
        -subj "/CN=$DOMAIN" 2>/dev/null
    echo "  Created placeholder certs"
else
    echo "  SSL certs already exist, skipping placeholder"
fi

# ─── 3. Start Docker containers ─────────────────────────────────────────
echo "🐳 Building and starting Docker containers..."
cd "$PROJECT_DIR"
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

echo ""
echo "⏳ Waiting 20 seconds for containers to initialize..."
sleep 20

echo "📊 Container status:"
docker ps --format 'table {{.Names}}\t{{.Status}}'

# ─── 4. Obtain real SSL certificate from Let's Encrypt ──────────────────
echo ""
echo "🔒 Obtaining SSL certificate from Let's Encrypt..."

# Stop nginx to free port 80 for certbot standalone
docker compose -f docker-compose.prod.yml stop nginx
sleep 2

certbot certonly --standalone \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    -m "$EMAIL" \
    --preferred-challenges http

# Copy the real certificates
echo "  Copying SSL certificates..."
cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$PROJECT_DIR/nginx/ssl/fullchain.pem"
cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$PROJECT_DIR/nginx/ssl/privkey.pem"

# Restart Nginx with real certs
echo "  Restarting Nginx with real SSL certificates..."
docker compose -f docker-compose.prod.yml up -d nginx

# ─── 5. Setup auto-renewal cron ─────────────────────────────────────────
echo "🔄 Setting up SSL auto-renewal..."
CRON_CMD="0 2 * * * certbot renew --quiet --deploy-hook 'cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $PROJECT_DIR/nginx/ssl/fullchain.pem && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $PROJECT_DIR/nginx/ssl/privkey.pem && docker restart zaytri-nginx'"
(crontab -l 2>/dev/null | grep -v certbot; echo "$CRON_CMD") | crontab -

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  ✅ Zaytri deployment complete!"
echo ""
echo "  🌐 HTTP:  http://$DOMAIN"
echo "  🔒 HTTPS: https://$DOMAIN"
echo "  📡 API:   https://$DOMAIN/api"
echo "  📖 Docs:  https://$DOMAIN/docs"
echo "══════════════════════════════════════════════════════════════"
