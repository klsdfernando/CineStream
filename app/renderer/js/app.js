/**
 * Main Application Entry Point
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize titlebar controls
    initTitlebar();

    // Initialize user auth state
    updateUserUI();

    // Check app version with server
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

/**
 * Update user UI based on authentication state
 */
function updateUserUI() {
    const userBtn = document.getElementById('user-profile-btn');
    const userAvatar = document.getElementById('user-avatar');
    const userLabel = document.getElementById('user-label');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const token = localStorage.getItem('authToken');

    if (user && token) {
        // User is logged in
        userBtn.classList.add('logged-in');
        userLabel.textContent = user.firstName || 'Profile';

        console.log('[UpdateUserUI] User data:', user);
        console.log('[UpdateUserUI] ProfilePic exists:', !!user.profilePic);

        // Show profile pic if available, otherwise show initials
        if (user.profilePic) {
            userAvatar.innerHTML = `<img src="${user.profilePic}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
            userAvatar.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; 
                            background: linear-gradient(135deg, var(--accent-green), #22c55e); color: #000; 
                            font-weight: 600; font-size: 12px;">${initials}</div>
            `;
        }
    } else {
        // User not logged in
        userBtn.classList.remove('logged-in');
        userLabel.textContent = 'Login';
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
window.logoutUser = function () {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    updateUserUI();
    router.navigate('home');
};
