#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  CineStream Server - One-Command VPS Setup
#  Usage: curl -sL https://raw.githubusercontent.com/klsdfernando/CineStream/main/setup-vps.sh | bash
#  Or:    bash setup-vps.sh
# ═══════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_banner() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║           CineStream Server - VPS Auto Setup              ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

# ── Pre-checks ──────────────────────────────────────────────
print_banner

# ── Collect info ────────────────────────────────────────────
step "Step 1/8: Configuration"

read -p "Enter your domain (e.g., api.example.com) or press Enter to skip: " DOMAIN </dev/tty

SERVER_DIR="/home/$USER/cinestream-server"

echo ""
log "Domain: ${DOMAIN:-'(no domain - IP only)'}"
log "Install dir: $SERVER_DIR"
log "NOTE: TMDB key, JWT secret, etc. can be set from the Admin Panel → Settings after setup!"
echo ""
read -p "Proceed? (y/n): " CONFIRM </dev/tty
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Aborted."
    exit 0
fi

# ── System update + dependencies ────────────────────────────
step "Step 2/8: Installing system packages"

sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential python3 nginx certbot python3-certbot-nginx iptables-persistent

# Install Node.js 20.x
if ! command -v node &> /dev/null || [[ "$(node -v)" != v20* ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
log "Node.js $(node -v) installed"

# Install PM2
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi
log "PM2 installed"

# ── Open firewall ports ─────────────────────────────────────
step "Step 3/8: Configuring firewall"

sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3001 -j ACCEPT 2>/dev/null || true
sudo netfilter-persistent save 2>/dev/null || true
log "Firewall ports 80, 443, 3001 opened"

# ── Clone repo + install ────────────────────────────────────
step "Step 4/8: Cloning CineStream server"

if [ -d "$SERVER_DIR" ]; then
    warn "Directory $SERVER_DIR already exists. Pulling latest..."
    cd "$SERVER_DIR"
    git pull
else
    rm -rf /tmp/cinestream-clone
    git clone https://github.com/klsdfernando/CineStream.git /tmp/cinestream-clone
    # Copy old_server to the deploy directory
    cp -r /tmp/cinestream-clone/old_server "$SERVER_DIR"
    rm -rf /tmp/cinestream-clone
fi

cd "$SERVER_DIR"
log "Server code ready at $SERVER_DIR"

# Install npm dependencies
npm install
npm install pino-pretty
log "Dependencies installed"

# ── Create .env ──────────────────────────────────────────────
step "Step 5/8: Creating configuration"

JWT_SECRET=$(openssl rand -hex 32)

cat > "$SERVER_DIR/.env" << EOF
PORT=3001
HOST=0.0.0.0
TMDB_API_KEY=
JWT_SECRET=$JWT_SECRET
ADMIN_PASSWORD=admin123
EOF
log ".env file created (JWT secret auto-generated)"
warn "Open Admin Panel → Settings to add your TMDB API Key!"

# Create data + uploads directories
mkdir -p "$SERVER_DIR/data"
mkdir -p "$SERVER_DIR/uploads/reports"
log "Data directories created"

# ── Setup Nginx ──────────────────────────────────────────────
step "Step 6/8: Configuring Nginx"

SERVER_NAME="${DOMAIN:-_}"

sudo tee /etc/nginx/sites-available/cinestream > /dev/null << EOF
server {
    listen 80;
    server_name $SERVER_NAME;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Max upload size for report images
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }
}
EOF

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/cinestream /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx && sudo systemctl enable nginx
log "Nginx configured and running"

# ── Start server with PM2 ───────────────────────────────────
step "Step 7/8: Starting CineStream server"

cd "$SERVER_DIR"
pm2 delete cinestream-api 2>/dev/null || true
pm2 start src/index.js --name "cinestream-api"
pm2 save

# Setup PM2 auto-start on reboot
PM2_STARTUP=$(pm2 startup 2>&1 | grep "sudo" | head -1)
if [ -n "$PM2_STARTUP" ]; then
    eval $PM2_STARTUP 2>/dev/null || true
fi
log "Server running with PM2"

# ── SSL + Cron + Backups ────────────────────────────────────
step "Step 8/8: Final setup (SSL, backups, anti-idle)"

# SSL (only if domain was provided)
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "_" ]; then
    log "Setting up SSL for $DOMAIN..."
    sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" --redirect || {
        warn "SSL setup failed. You can run it manually later:"
        warn "sudo certbot --nginx -d $DOMAIN"
    }
else
    warn "No domain provided — skipping SSL. Access via http://YOUR_IP"
fi

# Backup script
cat > /home/$USER/backup-cinestream.sh << 'BACKUP_EOF'
#!/bin/bash
BACKUP_DIR="/home/$USER/backups/cinestream"
SERVER_DIR="/home/$USER/cinestream-server"
DATE=$(date +%Y-%m-%d_%H%M)

mkdir -p $BACKUP_DIR
cp $SERVER_DIR/data/*.db "$BACKUP_DIR/" 2>/dev/null
# Rename with date
for f in $BACKUP_DIR/*.db; do
    [ -f "$f" ] && mv "$f" "${f%.db}_${DATE}.db"
done
# Keep only last 7 days
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
BACKUP_EOF
chmod +x /home/$USER/backup-cinestream.sh
log "Backup script created"

# Setup cron: anti-idle every 5 min + daily backup at 3 AM
(crontab -l 2>/dev/null | grep -v "cinestream"; echo "*/5 * * * * curl -s http://localhost:3001/health > /dev/null 2>&1"; echo "0 3 * * * /home/$USER/backup-cinestream.sh >> /home/$USER/backups/backup.log 2>&1") | crontab -
log "Cron jobs set (anti-idle + daily backups)"

# ── Done! ────────────────────────────────────────────────────
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_IP")

echo ""
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              ✅ CineStream Server is LIVE!                ║"
echo "╠════════════════════════════════════════════════════════════╣"
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "_" ]; then
echo "║  URL:         https://$DOMAIN"
else
echo "║  URL:         http://$PUBLIC_IP"
fi
echo "║  Health:      http://$PUBLIC_IP:3001/health"
echo "║  API Docs:    http://$PUBLIC_IP:3001/api"
echo "║  Admin Panel: http://$PUBLIC_IP:3001/admin/"
echo "║  Settings:    http://$PUBLIC_IP:3001/admin/settings.html"
echo "║                                                          ║"
echo "║  ⚡ NEXT STEP: Open Admin Panel → Settings               ║"
echo "║     and add your TMDB API Key!                           ║"
echo "║     (Login: admin / admin123)                            ║"
echo "║                                                          ║"
echo "║  PM2 Status:  pm2 status                                 ║"
echo "║  View Logs:   pm2 logs cinestream-api                    ║"
echo "║  Restart:     pm2 restart cinestream-api                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
