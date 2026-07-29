/**
 * Home Page - Browse Movies, TV Series, and Anime
 */

const HomePage = {
    currentView: 'movies', // 'movies' | 'tv' | 'anime'

    async render() {
        HeroCarousel.destroy();

        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="home-page fade-in">
                <div id="home-sections"></div>
            </div>
        `;

        this.syncTopToggle();
        this.setupTopToggle();
        await this.loadCurrentView();
    },

    setupTopToggle() {
        const toggle = document.getElementById('topnav-home-toggle');
        if (!toggle || toggle.dataset.bound === '1') return;
        toggle.dataset.bound = '1';

        toggle.querySelectorAll('.home-seg-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const view = btn.dataset.homeView;
                if (!view) return;

                if (router.currentPage !== 'home') {
                    this.currentView = view;
                    await router.navigate('home');
                    return;
                }

                await this.setView(view);
            });
        });
    },

    syncTopToggle() {
        document.querySelectorAll('#topnav-home-toggle .home-seg-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.homeView === this.currentView);
        });
    },

    async setView(view) {
        if (view === this.currentView && document.getElementById('home-sections')) {
            this.syncTopToggle();
            return;
        }
        this.currentView = view;
        this.syncTopToggle();
        await this.loadCurrentView();
    },

    async loadCurrentView() {
        if (this.currentView === 'tv') {
            await this.loadTVView();
        } else if (this.currentView === 'anime') {
            await this.loadAnimeView();
        } else {
            await this.loadMoviesView();
        }
    },

    async loadMoviesView() {
        const sectionsContainer = document.getElementById('home-sections');
        if (!sectionsContainer) return;
        HeroCarousel.destroy();
        sectionsContainer.innerHTML = `
            <div class="loading-screen">
                <div class="loading-spinner"></div>
                <p>Loading movies...</p>
            </div>
        `;

        try {
            const [trendingData, popularData, topRatedData, upcomingData] = await Promise.all([
                api.movies.getTrending('day'),
                api.movies.getPopular(),
                api.movies.getTopRated(),
                api.movies.getUpcoming ? api.movies.getUpcoming() : { results: [] }
            ]);

            sectionsContainer.innerHTML = '';

            const movies = (trendingData.results || []).filter(
                (m) => m.mediaType === 'movie' || !m.mediaType
            );
            const heroItems = this._pickHeroItems(movies.length ? movies : (popularData.results || []));

            if (heroItems.length > 0) {
                sectionsContainer.appendChild(
                    HeroCarousel.create({
                        items: heroItems,
                        railTitle: 'Trending Now',
                        mediaType: 'movie'
                    })
                );
            }

            if (movies.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({
                        title: 'Trending Movies',
                        iconType: 'fire',
                        movies
                    })
                );
            }

            if (popularData.results?.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({
                        title: 'Popular Movies',
                        iconType: 'clapperboard',
                        movies: popularData.results
                    })
                );
            }

            if (topRatedData.results?.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({
                        title: 'Top Rated Movies',
                        iconType: 'star',
                        movies: topRatedData.results
                    })
                );
            }

            if (upcomingData.results?.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({
                        title: 'Coming Soon',
                        iconType: 'calendar',
                        movies: upcomingData.results
                    })
                );
            }
        } catch (error) {
            console.error('Failed to load movies:', error);
            sectionsContainer.innerHTML = this._errorState('Failed to load movies. Please check your internet connection.');
        }
    },

    async loadTVView() {
        const sectionsContainer = document.getElementById('home-sections');
        if (!sectionsContainer) return;
        HeroCarousel.destroy();
        sectionsContainer.innerHTML = `
            <div class="loading-screen">
                <div class="loading-spinner"></div>
                <p>Loading TV series...</p>
            </div>
        `;

        try {
            const [trendingData, popularData, topRatedData, airingData] = await Promise.all([
                api.tv.getTrending ? api.tv.getTrending() : api.movies.getTrending('day'),
                api.tv.getPopular ? api.tv.getPopular() : { results: [] },
                api.tv.getTopRated ? api.tv.getTopRated() : { results: [] },
                api.tv.getAiring ? api.tv.getAiring() : { results: [] }
            ]);

            sectionsContainer.innerHTML = '';

            const tvShows = (trendingData.results || []).filter((m) => m.mediaType === 'tv');
            const heroSource = tvShows.length ? tvShows : (popularData.results || []);
            const heroItems = this._pickHeroItems(heroSource);

            if (heroItems.length > 0) {
                sectionsContainer.appendChild(
                    HeroCarousel.create({
                        items: heroItems,
                        railTitle: 'Trending Now',
                        mediaType: 'tv'
                    })
                );
            }

            if (tvShows.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({
                        title: 'Trending TV Series',
                        iconType: 'fire',
                        movies: tvShows
                    })
                );
            }

            if (popularData.results?.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({
                        title: 'Popular TV Series',
                        iconType: 'tv',
                        movies: popularData.results
                    })
                );
            }

            if (topRatedData.results?.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({
                        title: 'Top Rated TV Series',
                        iconType: 'star',
                        movies: topRatedData.results
                    })
                );
            }

            if (airingData.results?.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({
                        title: 'Currently Airing',
                        iconType: 'play',
                        movies: airingData.results
                    })
                );
            }
        } catch (error) {
            console.error('Failed to load TV series:', error);
            sectionsContainer.innerHTML = this._errorState('Failed to load TV series. Please check your internet connection.');
        }
    },

    async loadAnimeView() {
        const sectionsContainer = document.getElementById('home-sections');
        if (!sectionsContainer) return;
        HeroCarousel.destroy();
        sectionsContainer.innerHTML = `
            <div class="loading-screen">
                <div class="loading-spinner"></div>
                <p>Loading anime...</p>
            </div>
        `;

        try {
            const [trendingData, topRatedData, airingData, popularData] = await Promise.all([
                api.anime.getTrending(),
                api.anime.getTopRated(),
                api.anime.getAiring(),
                api.anime.getPopular()
            ]);

            sectionsContainer.innerHTML = '';

            const trending = trendingData.results || [];
            const heroItems = this._pickHeroItems(
                trending.length ? trending : (popularData.results || [])
            );

            if (heroItems.length > 0) {
                sectionsContainer.appendChild(
                    HeroCarousel.create({
                        items: heroItems,
                        railTitle: 'Trending Now',
                        mediaType: 'tv'
                    })
                );
            }

            if (trending.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({ title: 'Trending Anime', iconType: 'fire', movies: trending })
                );
            }
            if (topRatedData.results?.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({ title: 'Top Rated Anime', iconType: 'star', movies: topRatedData.results })
                );
            }
            if (airingData.results?.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({ title: 'Currently Airing', iconType: 'play', movies: airingData.results })
                );
            }
            if (popularData.results?.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({ title: 'Popular Anime', iconType: 'clapperboard', movies: popularData.results })
                );
            }
        } catch (error) {
            console.error('Failed to load anime:', error);
            sectionsContainer.innerHTML = this._errorState('Failed to load anime. Please check your internet connection.');
        }
    },

    _pickHeroItems(items) {
        return (items || [])
            .filter((m) => m && (m.backdrop || m.backdropOriginal))
            .slice(0, 12);
    },

    _errorState(message) {
        return `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p>${message}</p>
            </div>
        `;
    }
};

window.HomePage = HomePage;
