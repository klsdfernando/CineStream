/**
 * Simple Client-Side Router
 */

const router = {
    currentPage: 'home',
    currentParams: {},
    history: [],

    /**
     * Navigate to a page
     * @param {string} page - Page name (home, details, search, discover)
     * @param {Object} params - Optional parameters
     */
    async navigate(page, params = {}) {
        // Save current state to history
        this.history.push({ page: this.currentPage, params: this.currentParams });

        this.currentPage = page;
        this.currentParams = params;

        await this.render();
        this.updateSidebar();
    },

    /**
     * Go back in history
     */
    async back() {
        if (this.history.length > 0) {
            const previous = this.history.pop();
            this.currentPage = previous.page;
            this.currentParams = previous.params;
            await this.render();
            this.updateSidebar();
        } else {
            await this.navigate('home');
        }
    },

    /**
     * Render current page
     */
    async render() {
        const mainContent = document.getElementById('main-content');

        // Show loading
        mainContent.innerHTML = `
      <div class="loading-screen">
        <div class="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    `;

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
                await AnimePage.render();
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

    /**
     * Update sidebar active state
     */
    updateSidebar() {
        const sidebarItems = document.querySelectorAll('.sidebar-item');
        sidebarItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === this.currentPage) {
                item.classList.add('active');
            }
        });

        // For details and watch pages, keep home active
        if (this.currentPage === 'details' || this.currentPage === 'watch') {
            document.querySelector('.sidebar-item[data-page="home"]')?.classList.add('active');
        }
    },

    /**
     * Initialize router
     */
    init() {
        // Setup sidebar navigation
        const sidebarItems = document.querySelectorAll('.sidebar-item');
        sidebarItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) {
                    this.navigate(page);
                }
            });
        });

        // Initial render
        this.navigate('home');
    }
};

window.router = router;
