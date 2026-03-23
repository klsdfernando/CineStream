/**
 * Version Check - Checks if current app version is blocked
 * Shows warning banner or lockout overlay based on admin settings
 */

const VersionCheck = {
    currentVersion: '1.4.1',
    apiUrl: API_BASE_URL,

    async check() {
        try {
            const response = await fetch(`${this.apiUrl}/api/versions/check/${this.currentVersion}`);
            if (!response.ok) return;

            const data = await response.json();

            if (data.blocked) {
                if (data.mode === 'lockout') {
                    this.showLockout(data.message, data.downloadUrl);
                } else {
                    this.showWarning(data.message, data.downloadUrl);
                }
            }
        } catch (error) {
            console.log('[VersionCheck] Could not check version:', error.message);
        }
    },

    showWarning(message, downloadUrl) {
        // Remove existing warning if any
        const existing = document.getElementById('version-warning');
        if (existing) existing.remove();

        const banner = document.createElement('div');
        banner.id = 'version-warning';
        banner.className = 'version-warning';
        banner.innerHTML = `
            <div class="version-warning-content">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span class="version-warning-message">${this.escapeHtml(message)}</span>
                ${downloadUrl ? `
                    <button id="warning-download-btn" class="version-warning-download">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Download Update
                    </button>
                ` : ''}
                <button id="warning-close-btn" class="version-warning-close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `;

        document.body.insertBefore(banner, document.body.firstChild);

        // Attach event listeners
        document.getElementById('warning-close-btn').onclick = () => this.dismissWarning();

        if (downloadUrl) {
            document.getElementById('warning-download-btn').onclick = () => this.openUrl(downloadUrl);
        }
    },

    dismissWarning() {
        const warning = document.getElementById('version-warning');
        if (warning) {
            warning.classList.add('dismissing');
            setTimeout(() => warning.remove(), 300);
        }
    },

    showLockout(message, downloadUrl) {
        const overlay = document.createElement('div');
        overlay.id = 'version-lockout';
        overlay.className = 'version-lockout';
        overlay.innerHTML = `
            <div class="version-lockout-content">
                <div class="version-lockout-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                </div>
                <h1>Update Required</h1>
                <p class="version-lockout-message">${this.escapeHtml(message)}</p>
                <div class="version-lockout-version">
                    Current Version: <span>${this.currentVersion}</span>
                </div>
                ${downloadUrl ? `
                    <button id="lockout-download-btn" class="version-lockout-button">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Download New Version
                    </button>
                ` : `
                    <p class="version-lockout-note">Please contact support for the latest version.</p>
                `}
            </div>
        `;

        document.body.appendChild(overlay);

        // Attach event listeners
        if (downloadUrl) {
            document.getElementById('lockout-download-btn').onclick = () => this.openUrl(downloadUrl);
        }
    },

    openUrl(url) {
        console.log('[VersionCheck] Opening URL:', url);
        if (window.electronAPI && window.electronAPI.openExternal) {
            window.electronAPI.openExternal(url);
        } else {
            // Fallback for browser testing
            window.open(url, '_blank');
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.VersionCheck = VersionCheck;
