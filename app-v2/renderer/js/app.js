/**
 * Main Application Entry Point
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize titlebar controls
    initTitlebar();

    // Initialize brand loader
    if (window.AppLoader) AppLoader.init();

    // Re-establish the Supabase session before the router renders anything,
    // so the first page doesn't query the database as a guest.
    await restoreSessionOnce();

    // Initialize user auth state
    updateUserUI();

    // Check app version
    if (window.VersionCheck) {
        VersionCheck.check();
    }

    // Initialize router
    router.init();
});

/**
 * Initialize custom titlebar controls
 */
function initTitlebar() {
    const minimizeBtn = document.getElementById('btn-minimize');
    const maximizeBtn = document.getElementById('btn-maximize');
    const closeBtn = document.getElementById('btn-close');

    if (window.electronAPI) {
        minimizeBtn?.addEventListener('click', () => {
            window.electronAPI.minimizeWindow();
        });

        maximizeBtn?.addEventListener('click', () => {
            window.electronAPI.maximizeWindow();
        });

        closeBtn?.addEventListener('click', () => {
            window.electronAPI.closeWindow();
        });
    } else {
        // Running in browser - hide titlebar
        const titlebar = document.getElementById('titlebar');
        if (titlebar) {
            titlebar.style.display = 'none';
            document.querySelector('.app-container').style.marginTop = '0';
            document.querySelector('.app-container').style.height = '100vh';
        }
    }
}

let sessionRestorePromise = null;

/**
 * Hand the stored refresh token back to the main process so it can
 * re-establish the Supabase session. Runs at most once per launch.
 * If the token is dead we clear the cached user so the UI shows logged out
 * instead of pretending we are still signed in.
 */
function restoreSessionOnce() {
    if (sessionRestorePromise) return sessionRestorePromise;

    sessionRestorePromise = (async () => {
        if (!window.api?.auth?.restoreSession) return;

        try {
            const res = await api.auth.restoreSession();

            if (res?.success && res.user) {
                localStorage.setItem('user', JSON.stringify(res.user));
                localStorage.setItem('authToken', res.token || 'restored-token');
                return;
            }

            if (localStorage.getItem('user')) {
                console.warn('[App] Stored session is no longer valid, signing out.');
                localStorage.removeItem('user');
                localStorage.removeItem('authToken');
            }
        } catch (e) {
            console.warn('[App] Session restore error:', e);
        }
    })();

    return sessionRestorePromise;
}

window.restoreSessionOnce = restoreSessionOnce;

/**
 * Update user UI based on authentication state
 */
async function updateUserUI() {
    const userBtn = document.getElementById('user-profile-btn');
    const userAvatar = document.getElementById('user-avatar');
    const userLabel = document.getElementById('user-label');
    const activityNav = document.getElementById('nav-activity');
    const logoutBtn = document.getElementById('nav-logout');
    const logoutDivider = document.getElementById('logout-divider');

    // The main process holds the Supabase session, and it starts empty on
    // every launch. Restore it once per run even when localStorage already
    // has a user, otherwise the UI looks signed in while every database
    // query runs as an anonymous guest.
    await restoreSessionOnce();

    let user = JSON.parse(localStorage.getItem('user') || 'null');
    let token = localStorage.getItem('authToken');

    if (user && token) {
        // User is logged in
        userBtn?.classList.add('logged-in');
        if (userLabel) userLabel.textContent = user.firstName || 'Profile';
        if (activityNav) activityNav.style.display = '';
        if (logoutBtn) logoutBtn.hidden = false;
        if (logoutDivider) logoutDivider.hidden = false;

        // Show profile pic if available, otherwise show initials
        if (user.profilePic) {
            userAvatar.innerHTML = `<img src="${user.profilePic}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
            userAvatar.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; 
                            background: linear-gradient(135deg, var(--accent-green), #22c55e); color: #000; 
                            font-weight: 600; font-size: 12px;">${initials || 'U'}</div>
            `;
        }
    } else {
        // User not logged in
        userBtn?.classList.remove('logged-in');
        if (userLabel) userLabel.textContent = 'Login';
        if (activityNav) activityNav.style.display = 'none';
        if (logoutBtn) logoutBtn.hidden = true;
        if (logoutDivider) logoutDivider.hidden = true;
        userAvatar.innerHTML = `
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
        `;
    }
}

// Make updateUserUI globally accessible
window.updateUserUI = updateUserUI;

// Logout function
window.logoutUser = async function () {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    if (window.api?.auth?.signout) {
        await api.auth.signout();
    }
    await updateUserUI();
    router.navigate('home');
};
