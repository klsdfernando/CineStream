# CineStream 🎬

A cross-platform movie streaming application built with Electron, Node.js, and WebTorrent.

## Project Structure
- **`app/`**: Electron Desktop Application (Client)
- **`server/`**: Node.js API Backend (Server)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- NPM
- Git

### 1. Client App (Desktop)
Located in `app/`.

```bash
cd app
npm install
npm start       # Run in development mode
npm run dist    # Build for Windows/Linux/Mac
```

### 2. Backend Server
Located in `server/`.

```bash
cd server
npm install
npm run dev     # Start server
```

## 🌍 Configuration

1.  **Server**: Create `server/.env`
    ```env
    PORT=3001
    TMDB_API_KEY=your_key_here
    JWT_SECRET=your_secret
    ADMIN_PASSWORD=your_password
    ```

2.  **Client**: Update API URL in `app/renderer/js/api.js`
    ```javascript
    const API_BASE_URL = 'https://your-server-domain.com';
    ```

## 📦 VPS Deployment Guide

### 1. Prepare New VPS
Run these commands on your Ubuntu VPS (via SSH):

```bash
# Install Node.js, Nginx, PM2, Utilities
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git unzip nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 2. Backup Old Server (Data & Secrets)
Run these commands on your **Local Machine** to download data from the old server:

```bash
# Create local backup folder
mkdir C:\MovieAppBackup
cd C:\MovieAppBackup

# Download Data (.db files and .env)
# Replace 'OLD_VPS_IP' with your old server IP
scp -r root@OLD_VPS_IP:/root/movie-app-server/data .
scp root@OLD_VPS_IP:/root/movie-app-server/.env .
```

### 3. Upload to New VPS
Run these on your **Local Machine** to upload everything to the new server:

```bash
# 1. Upload Server Code
cd "path/to/Movie App"
scp -r server root@NEW_VPS_IP:/root/movie-app-server

# 2. Upload Backup Data (Restore)
cd C:\MovieAppBackup
scp -r data root@NEW_VPS_IP:/root/movie-app-server/
scp .env root@NEW_VPS_IP:/root/movie-app-server/
```

### 4. Start Server (New VPS)
SSH into the New VPS and run:

```bash
cd /root/movie-app-server
npm install
npm install pino-pretty

# Start with PM2
pm2 start src/index.js --name "movie-api"
pm2 save
pm2 startup
```

### 5. Setup SSL (HTTPS)
On the New VPS:
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Configure Nginx (See migration.md for full config)
# Then enable SSL:
sudo certbot --nginx -d your-domain.com
```

## 🛠️ Built With
- **Electron**: Desktop Framework
- **Fastify**: Backend Framework
- **SQLite**: Database
- **WebTorrent**: Streaming Engine
