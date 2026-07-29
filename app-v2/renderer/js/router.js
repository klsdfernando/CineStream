/**
 * Simple Client-Side Router
 */

const router = {
    currentPage: 'home',
    currentParams: {},
    history: [],
    overlayPages: ['home', 'details', 'watch'],

    /**
     * Navigate to a page
     * @param {string} page - Page name (home, details, search, discover)
     * @param {Object} params - Optional parameters
     */
    async navigate(page, params = {}) {
        this.closeProfileMenu();
        AppLoader.show();

        try {
            // Save current state to history
            this.history.push({ page: this.currentPage, params: this.currentParams });

            this.currentPage = page;
            this.currentParams = params;

            await this.render();
            this.updateNav();
        } finally {
            AppLoader.hide();
        }
    },

    /**
     * Go back in history
     */
    async back() {
        this.closeProfileMenu();
        AppLoader.show();
        try {
            if (this.history.length > 0) {
                const previous = this.history.pop();
                this.currentPage = previous.page;
                this.currentParams = previous.params;
                await this.render();
                this.updateNav();
            } else {
                this.currentPage = 'home';
                this.currentParams = {};
                await this.render();
                this.updateNav();
            }
        } finally {
            AppLoader.hide();
        }
    },

    /**
     * Render current page
     */
    async render() {
        const mainContent = document.getElementById('main-content');
        // Keep content empty while global brand loader is shown
        mainContent.innerHTML = '';

        // Render page based on current route
        switch (this.currentPage) {
            case 'home':
                await HomePage.render();
                break;
            case 'details':
                await DetailsPage.render(this.currentParams);
                break;
            case 'search':
                await SearchPage.render();
                break;
            case 'discover':
                await DiscoverPage.render();
                break;
            case 'anime':
                // Anime now lives in the Home Movies/TV/Anime switcher
                HomePage.currentView = 'anime';
                this.currentPage = 'home';
                await HomePage.render();
                break;
            case 'watch':
                await WatchPage.render(this.currentParams);
                break;
            case 'person':
                await PersonPage.render(this.currentParams);
                break;
            case 'activity':
                if (localStorage.getItem('authToken')) {
                    await ActivityPage.render();
                } else {
                    await AuthPage.render();
                }
                break;
            case 'auth':
                // If logged in, go to profile instead
                if (localStorage.getItem('authToken')) {
                    await ProfilePage.render();
                } else {
                    await AuthPage.render();
                }
                break;
            case 'profile':
                await ProfilePage.render();
                break;
            case 'downloads':
                await DownloadsPage.render();
                break;
            case 'report':
                await ReportPage.render();
                break;
            case 'about':
                await AboutPage.render();
                break;
            default:
                await HomePage.render();
        }

        // Scroll to top
        mainContent.scrollTop = 0;
    },

    closeProfileMenu() {
        const wrap = document.getElementById('topnav-profile-wrap');
        const btn = document.getElementById('user-profile-btn');
        if (!wrap) return;
        wrap.classList.remove('is-open');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    },

    toggleProfileMenu() {
        const wrap = document.getElementById('topnav-profile-wrap');
        const btn = document.getElementById('user-profile-btn');
        if (!wrap || !btn) return;

        const willOpen = !wrap.classList.contains('is-open');
        wrap.classList.toggle('is-open', willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    },

    /**
     * Update top navigation active state + overlay/solid mode
     */
    updateNav() {
        const topnav = document.getElementById('topnav');
        const navItems = document.querySelectorAll('#topnav [data-page]');
        const page = this.currentPage;
        const activePage = (page === 'details' || page === 'watch' || page === 'person')
            ? 'home'
            : (page === 'profile' ? 'auth' : page);

        navItems.forEach((item) => {
            item.classList.remove('active');
            if (item.dataset.page === activePage) {
                item.classList.add('active');
            }
        });

        const useOverlay = this.overlayPages.includes(page);
        if (topnav) {
            topnav.classList.toggle('topnav--overlay', useOverlay);
            topnav.classList.toggle('topnav--solid', !useOverlay);
        }
        document.body.classList.toggle('nav-solid', !useOverlay);
        document.body.dataset.page = page;

        // Keep home content switcher in sync when landing on home
        if (page === 'home' && window.HomePage) {
            HomePage.syncTopToggle();
            HomePage.setupTopToggle();
        }
    },

    /**
     * Initialize router
     */
    init() {
        const navItems = document.querySelectorAll('#topnav [data-page]');
        navItems.forEach((item) => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) {
                    this.navigate(page);
                }
            });
        });

        const profileBtn = document.getElementById('user-profile-btn');
        profileBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleProfileMenu();
        });

        document.getElementById('nav-logout')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.logoutUser === 'function') {
                window.logoutUser();
            }
            this.closeProfileMenu();
        });

        document.addEventListener('click', (e) => {
            const wrap = document.getElementById('topnav-profile-wrap');
            if (wrap && !wrap.contains(e.target)) {
                this.closeProfileMenu();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeProfileMenu();
        });

        // Home Movies / TV / Anime switcher
        if (window.HomePage) {
            HomePage.setupTopToggle();
        }

        // Initial render
        this.navigate('home');
    }
};

window.router = router;
