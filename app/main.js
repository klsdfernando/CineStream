const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const torrentManager = require('./main/torrentManager');

// Keep a global reference of the window object
let mainWindow;

// List of ad/tracking domains to block
const BLOCKED_DOMAINS = [
    // Ad networks
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'google-analytics.com',
    'googletagmanager.com',
    'facebook.net',
    'fbcdn.net',
    'amazon-adsystem.com',
    'advertising.com',
    'adnxs.com',
    'adsco.re',
    'adservice.google.com',

    // Tracking
    'mc.yandex.ru',
    'yandex.ru/metrika',
    'hotjar.com',
    'mixpanel.com',
    'segment.com',
    'amplitude.com',

    // Popup/redirect domains
    'popads.net',
    'popcash.net',
    'propellerads.com',
    'revcontent.com',
    'taboola.com',
    'outbrain.com',
    'mgid.com',

    // Common video ad networks
    'imasdk.googleapis.com',
    'pagead2.googlesyndication.com',
    'tpc.googlesyndication.com',
    'securepubads.g.doubleclick.net',

    // Specific to video players
    'juicyads.com',
    'exoclick.com',
    'trafficjunky.com',
    'trafficfactory.biz',
    'clickadu.com',
    'hilltopads.net',
    'adsterra.com',
    'a]d-maven.com',
    'adcash.com'
];

/**
 * Setup ad blocker using webRequest API
 */
function setupAdBlocker() {
    const filter = {
        urls: ['*://*/*']
    };

    // Block requests to ad domains
    session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
        const url = details.url.toLowerCase();

        // Check if URL matches any blocked domain
        const shouldBlock = BLOCKED_DOMAINS.some(domain => url.includes(domain));

        if (shouldBlock) {
            console.log('[AdBlocker] Blocked:', url.substring(0, 80));
            callback({ cancel: true });
        } else {
            callback({ cancel: false });
        }
    });

    console.log('[AdBlocker] Ad blocker initialized with', BLOCKED_DOMAINS.length, 'blocked domains');
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
    // Setup ad blocker before creating window
    setupAdBlocker();

    createWindow();

    // Initialize torrent manager
    torrentManager.init(mainWindow);

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
