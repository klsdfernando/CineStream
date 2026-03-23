const { contextBridge, ipcRenderer, shell } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Shell - Open external links
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

    // Window controls
    minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
    closeWindow: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

    // Torrent/Download controls
    torrent: {
        start: (magnetLink, movieInfo) => ipcRenderer.invoke('torrent:start', magnetLink, movieInfo),
        pause: (infoHash) => ipcRenderer.invoke('torrent:pause', infoHash),
        resume: (infoHash) => ipcRenderer.invoke('torrent:resume', infoHash),
        cancel: (infoHash) => ipcRenderer.invoke('torrent:cancel', infoHash),
        getAll: () => ipcRenderer.invoke('torrent:getAll'),
        getPath: () => ipcRenderer.invoke('torrent:getPath'),
        setPath: (newPath) => ipcRenderer.invoke('torrent:setPath', newPath),

        // Event listeners for progress updates
        onProgress: (callback) => ipcRenderer.on('torrent:progress', (event, data) => callback(data)),
        onCompleted: (callback) => ipcRenderer.on('torrent:completed', (event, data) => callback(data)),
        onError: (callback) => ipcRenderer.on('torrent:error', (event, data) => callback(data)),

        // Remove all listeners (for cleanup)
        removeAllListeners: () => {
            ipcRenderer.removeAllListeners('torrent:progress');
            ipcRenderer.removeAllListeners('torrent:completed');
            ipcRenderer.removeAllListeners('torrent:error');
        }
    },

    // Platform info
    platform: process.platform,
});
