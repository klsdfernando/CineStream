require('dotenv').config();
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const torrentManager = require('./main/torrentManager');

// Import IPC Handlers
const { registerTmdbHandlers } = require('./main/ipc/tmdbHandlers');
const { registerAuthHandlers } = require('./main/ipc/authHandlers');
const { registerActivityHandlers } = require('./main/ipc/activityHandlers');
const { registerPlaylistHandlers } = require('./main/ipc/playlistHandlers');
const { registerUserDataHandlers } = require('./main/ipc/userDataHandlers');
const { registerReportHandlers } = require('./main/ipc/reportHandlers');
const { registerTorrentHandlers } = require('./main/ipc/torrentHandlers');
const { registerSubtitleHandlers } = require('./main/ipc/subtitleHandlers');
const { registerStreamHandlers } = require('./main/ipc/streamHandlers');

const streamSniffer = require('./main/services/streamSniffer');
const streamDownloader = require('./main/services/streamDownloader');

// Keep a global reference of the window object
let mainWindow;

// List of ad/tracking domains to block
const BLOCKED_DOMAINS = [
    // Ad networks
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
    'google-analytics.com', 'googletagmanager.com', 'facebook.net',
    'fbcdn.net', 'amazon-adsystem.com', 'advertising.com', 'adnxs.com',
    'adsco.re', 'adservice.google.com',

    // Tracking
    'mc.yandex.ru', 'yandex.ru/metrika', 'hotjar.com', 'mixpanel.com',
    'segment.com', 'amplitude.com',

    // Popup/redirect domains
    'popads.net', 'popcash.net', 'propellerads.com', 'revcontent.com',
    'taboola.com', 'outbrain.com', 'mgid.com',

    // Common video ad networks
    'imasdk.googleapis.com', 'pagead2.googlesyndication.com',
    'tpc.googlesyndication.com', 'securepubads.g.doubleclick.net',

    // Specific to video players
    'juicyads.com', 'exoclick.com', 'trafficjunky.com', 'trafficfactory.biz',
    'clickadu.com', 'hilltopads.net', 'adsterra.com', 'ad-maven.com', 'adcash.com'
];

/**
 * Setup webRequest listener for ad blocker & stream sniffer
 */
function setupWebRequestHandlers() {
    const filter = { urls: ['*://*/*'] };

    session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
        const url = details.url.toLowerCase();
        const shouldBlock = BLOCKED_DOMAINS.some(domain => url.includes(domain));

        if (shouldBlock) {
            console.log('[AdBlocker] Blocked:', url.substring(0, 80));
            return callback({ cancel: true });
        }

        // Pass to stream sniffer if it matches stream formats (.m3u8, .mp4, master.txt, playlist.txt, index.txt)
        if (url.includes('.m3u8') || url.includes('.mp4') || url.includes('master.txt') || url.includes('playlist.txt') || url.includes('index.txt')) {
            if (!streamSniffer.shouldIgnoreUrl(url)) {
                const playerSource = streamSniffer.identifyPlayerSource(details.referrer || details.url);
                streamSniffer.processDetectedUrl(details.url, playerSource, details.referrer);
            }
        }

        callback({ cancel: false });
    });

    console.log('[WebRequest] Combined Ad blocker & Stream Sniffer initialized');
}

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        backgroundColor: '#0a0a0a',
        frame: false, // Frameless window for custom titlebar
        titleBarStyle: 'hidden',
        fullscreenable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            // Enable webview for video player with fullscreen support
            webviewTag: true,
            // Allow fullscreen for embedded content
            allowRunningInsecureContent: false,
            webSecurity: true,
        },
        icon: path.join(__dirname, 'renderer/assets/icon.png'),
    });

    // Handle fullscreen requests from iframes
    mainWindow.webContents.on('enter-html-full-screen', () => {
        console.log('[Fullscreen] Entered HTML fullscreen');
    });

    mainWindow.webContents.on('leave-html-full-screen', () => {
        console.log('[Fullscreen] Left HTML fullscreen');
    });

    // Block popup windows (ads from video player)
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        console.log('[PopupBlocker] Blocked popup:', url.substring(0, 80));
        // Only allow YouTube embeds
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return { action: 'allow' };
        }
        return { action: 'deny' };
    });

    // Allow fullscreen and other permissions for video player iframes
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        // Allow these permissions from any origin
        const allowedPermissions = ['fullscreen', 'pointerLock', 'media', 'mediaKeySystem', 'geolocation'];
        if (allowedPermissions.includes(permission)) {
            console.log('[Permissions] Allowed:', permission);
            callback(true);
        } else {
            console.log('[Permissions] Denied:', permission);
            callback(false);
        }
    });

    // Also handle permission check (synchronous check)
    mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
        const allowedPermissions = ['fullscreen', 'pointerLock', 'media', 'mediaKeySystem'];
        if (allowedPermissions.includes(permission)) {
            return true;
        }
        return false;
    });

    // Load the index.html file
    mainWindow.loadFile('renderer/index.html');

    // Open DevTools in development
    if (process.argv.includes('--enable-logging')) {
        mainWindow.webContents.openDevTools();
    }

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Window control handlers
ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});

ipcMain.handle('window:close', () => {
    mainWindow?.close();
});

ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() || false;
});

// Shell handlers
const { shell } = require('electron');
ipcMain.handle('shell:openExternal', async (event, url) => {
    try {
        await shell.openExternal(url);
        return { success: true };
    } catch (error) {
        console.error('Failed to open external URL:', error);
        return { success: false, error: error.message };
    }
});

// App ready
app.whenReady().then(() => {
    // Setup webRequest listener for ad blocker & stream sniffer
    setupWebRequestHandlers();

    // Register all IPC handlers
    registerTmdbHandlers();
    registerAuthHandlers();
    registerActivityHandlers();
    registerPlaylistHandlers();
    registerUserDataHandlers();
    registerReportHandlers();
    registerTorrentHandlers();
    registerSubtitleHandlers();
    registerStreamHandlers();

    createWindow();

    // Initialize services with main window
    torrentManager.init(mainWindow);
    streamSniffer.init(mainWindow);
    streamDownloader.init(mainWindow);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        torrentManager.destroy();
        app.quit();
    }
});
