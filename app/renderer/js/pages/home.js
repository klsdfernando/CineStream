/**
 * Home Page - Browse Movies and TV Series
 */

const HomePage = {
    currentView: 'movies', // 'movies' or 'tv'

    async render() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="home-page fade-in">
                <div class="page-header home-header">
                    <h1>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                        Home
                    </h1>
                    <div class="view-toggle">
                        <button class="toggle-btn active" id="btn-movies">Movies</button>
                        <button class="toggle-btn" id="btn-tv">TV Series</button>
                    </div>
                </div>
                
                <div id="home-sections"></div>
            </div>
        `;

        // Setup toggle buttons
        this.setupToggle();

        // Load movies view initially
        await this.loadMoviesView();
    },

    setupToggle() {
        const moviesBtn = document.getElementById('btn-movies');
        const tvBtn = document.getElementById('btn-tv');

        moviesBtn.addEventListener('click', async () => {
            if (this.currentView === 'movies') return;

            moviesBtn.classList.add('active');
            tvBtn.classList.remove('active');
            this.currentView = 'movies';
            await this.loadMoviesView();
        });

        tvBtn.addEventListener('click', async () => {
            if (this.currentView === 'tv') return;

            tvBtn.classList.add('active');
            moviesBtn.classList.remove('active');
            this.currentView = 'tv';
            await this.loadTVView();
        });
    },

    async loadMoviesView() {
        const sectionsContainer = document.getElementById('home-sections');
        sectionsContainer.innerHTML = `
            <div class="loading-screen">
                <div class="loading-spinner"></div>
                <p>Loading movies...</p>
            </div>
        `;

        try {
            // Load all movie sections in parallel
            const [trendingData, popularData, topRatedData, upcomingData] = await Promise.all([
                api.movies.getTrending('day'),
                api.movies.getPopular(),
                api.movies.getTopRated(),
                api.movies.getUpcoming ? api.movies.getUpcoming() : { results: [] }
            ]);

            sectionsContainer.innerHTML = '';

            // Trending Movies
            if (trendingData.results?.length > 0) {
                // Filter to only movies
                const movies = trendingData.results.filter(m => m.mediaType === 'movie' || !m.mediaType);
                if (movies.length > 0) {
                    sectionsContainer.appendChild(
                        Carousel.create({
                            title: 'Trending Movies',
                            iconType: 'fire',
                            movies: movies
                        })
                    );
                }
            }

            // Popular Movies
            if (popularData.results?.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({
                        title: 'Popular Movies',
                        iconType: 'clapperboard',
                        movies: popularData.results
                    })
                );
            }

            // Top Rated Movies
            if (topRatedData.results?.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({
                        title: 'Top Rated Movies',
                        iconType: 'star',
                        movies: topRatedData.results
                    })
                );
            }

            // Upcoming Movies
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
            sectionsContainer.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p>Failed to load movies. Please make sure the server is running.</p>
                </div>
            `;
        }
    },

    async loadTVView() {
        const sectionsContainer = document.getElementById('home-sections');
        sectionsContainer.innerHTML = `
            <div class="loading-screen">
                <div class="loading-spinner"></div>
                <p>Loading TV series...</p>
            </div>
        `;

        try {
            // Load all TV sections in parallel
            const [trendingData, popularData, topRatedData, airingData] = await Promise.all([
                api.tv.getTrending ? api.tv.getTrending() : api.movies.getTrending('day'),
                api.tv.getPopular ? api.tv.getPopular() : { results: [] },
                api.tv.getTopRated ? api.tv.getTopRated() : { results: [] },
                api.tv.getAiring ? api.tv.getAiring() : { results: [] }
            ]);

            sectionsContainer.innerHTML = '';

            // Trending TV
            if (trendingData.results?.length > 0) {
                // Filter to only TV shows
                const tvShows = trendingData.results.filter(m => m.mediaType === 'tv');
                if (tvShows.length > 0) {
                    sectionsContainer.appendChild(
                        Carousel.create({
                            title: 'Trending TV Series',
                            iconType: 'fire',
                            movies: tvShows
                        })
                    );
                }
            }

            // Popular TV
            if (popularData.results?.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({
                        title: 'Popular TV Series',
                        iconType: 'tv',
                        movies: popularData.results
                    })
                );
            }

            // Top Rated TV
            if (topRatedData.results?.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({
                        title: 'Top Rated TV Series',
                        iconType: 'star',
                        movies: topRatedData.results
                    })
                );
            }

            // Currently Airing
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
            sectionsContainer.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p>Failed to load TV series. Please make sure the server is running.</p>
                </div>
            `;
        }
    }
};

window.HomePage = HomePage;
