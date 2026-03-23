/**
 * Anime Page - Browse and discover anime content
 */

const AnimePage = {
    genres: [],
    currentPage: 1,
    currentFilters: {
        genre: '',
        sortBy: 'popularity.desc',
        year: ''
    },
    isLoading: false,
    showingDiscover: false,

    async render() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="anime-page fade-in">
                <div class="page-header anime-header">
                    <h1>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        Anime
                    </h1>
                    <div class="view-toggle">
                        <button class="toggle-btn active" id="btn-browse">Browse</button>
                        <button class="toggle-btn" id="btn-discover">Discover</button>
                    </div>
                </div>
                
                <!-- Browse View (Carousels) -->
                <div id="browse-view">
                    <div id="anime-sections"></div>
                </div>
                
                <!-- Discover View (Grid with Filters) -->
                <div id="discover-view" style="display: none;">
                    <div class="discover-filters">
                        <div class="filter-group">
                            <label class="filter-label">Sort By</label>
                            <select class="filter-select" id="anime-filter-sort">
                                <option value="popularity.desc">Most Popular</option>
                                <option value="vote_average.desc">Highest Rated</option>
                                <option value="first_air_date.desc">Newest First</option>
                                <option value="first_air_date.asc">Oldest First</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">Year</label>
                            <select class="filter-select" id="anime-filter-year">
                                <option value="">All Years</option>
                                ${this.generateYearOptions()}
                            </select>
                        </div>
                    </div>
                    
                    <div class="discover-genres" id="anime-genre-buttons">
                        <button class="genre-btn active" data-genre="">All Genres</button>
                    </div>
                    
                    <div class="discover-grid" id="anime-discover-grid"></div>
                    
                    <div class="load-more-container">
                        <button class="load-more-btn" id="anime-load-more-btn">Load More</button>
                    </div>
                </div>
            </div>
        `;

        // Setup toggle buttons
        this.setupToggle();

        // Load browse view initially
        await this.loadBrowseView();
    },

    generateYearOptions() {
        const currentYear = new Date().getFullYear();
        let options = '';
        for (let year = currentYear; year >= 1980; year--) {
            options += `<option value="${year}">${year}</option>`;
        }
        return options;
    },

    setupToggle() {
        const browseBtn = document.getElementById('btn-browse');
        const discoverBtn = document.getElementById('btn-discover');
        const browseView = document.getElementById('browse-view');
        const discoverView = document.getElementById('discover-view');

        browseBtn.addEventListener('click', async () => {
            browseBtn.classList.add('active');
            discoverBtn.classList.remove('active');
            browseView.style.display = 'block';
            discoverView.style.display = 'none';

            if (!this.showingDiscover) return;
            this.showingDiscover = false;
        });

        discoverBtn.addEventListener('click', async () => {
            discoverBtn.classList.add('active');
            browseBtn.classList.remove('active');
            discoverView.style.display = 'block';
            browseView.style.display = 'none';

            if (this.showingDiscover) return;
            this.showingDiscover = true;
            await this.loadDiscoverView();
        });
    },

    async loadBrowseView() {
        const sectionsContainer = document.getElementById('anime-sections');
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

            if (trendingData.results?.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({ title: 'Trending Anime', iconType: 'fire', movies: trendingData.results })
                );
            }
            if (topRatedData.results?.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({ title: 'Top Rated Anime', iconType: 'trophy', movies: topRatedData.results })
                );
            }
            if (airingData.results?.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({ title: 'Currently Airing', iconType: 'play', movies: airingData.results })
                );
            }
            if (popularData.results?.length > 0) {
                sectionsContainer.appendChild(
                    Carousel.create({ title: 'Popular Anime', iconType: 'star', movies: popularData.results })
                );
            }
        } catch (error) {
            console.error('Failed to load anime:', error);
            sectionsContainer.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p>Failed to load anime. Please make sure the server is running.</p>
                </div>
            `;
        }
    },

    async loadDiscoverView() {
        // Load genres if not already loaded
        if (this.genres.length === 0) {
            await this.loadGenres();
        }

        // Setup event listeners
        this.setupDiscoverListeners();

        // Initial load
        await this.loadAnimeGrid();
    },

    async loadGenres() {
        try {
            this.genres = await api.anime.getGenres();
            const container = document.getElementById('anime-genre-buttons');

            this.genres.forEach(genre => {
                const btn = document.createElement('button');
                btn.className = 'genre-btn';
                btn.dataset.genre = genre.id;
                btn.textContent = genre.name;
                btn.addEventListener('click', () => this.selectGenre(genre.id, btn));
                container.appendChild(btn);
            });
        } catch (error) {
            console.error('Failed to load genres:', error);
        }
    },

    setupDiscoverListeners() {
        document.getElementById('anime-filter-sort').addEventListener('change', (e) => {
            this.currentFilters.sortBy = e.target.value;
            this.resetAndLoad();
        });

        document.getElementById('anime-filter-year').addEventListener('change', (e) => {
            this.currentFilters.year = e.target.value;
            this.resetAndLoad();
        });

        document.querySelector('#anime-genre-buttons .genre-btn[data-genre=""]').addEventListener('click', (e) => {
            this.selectGenre('', e.target);
        });

        document.getElementById('anime-load-more-btn').addEventListener('click', () => {
            this.loadMore();
        });
    },

    selectGenre(genreId, btn) {
        document.querySelectorAll('#anime-genre-buttons .genre-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilters.genre = genreId;
        this.resetAndLoad();
    },

    async resetAndLoad() {
        this.currentPage = 1;
        document.getElementById('anime-discover-grid').innerHTML = '';
        await this.loadAnimeGrid();
    },

    async loadAnimeGrid() {
        if (this.isLoading) return;
        this.isLoading = true;

        const grid = document.getElementById('anime-discover-grid');
        const loadMoreBtn = document.getElementById('anime-load-more-btn');
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'Loading...';

        try {
            const data = await api.anime.discover({
                page: this.currentPage,
                sortBy: this.currentFilters.sortBy,
                genre: this.currentFilters.genre,
                year: this.currentFilters.year
            });

            if (data.results?.length > 0) {
                grid.appendChild(MovieCard.createMultiple(data.results));
            }

            if (this.currentPage >= data.totalPages) {
                loadMoreBtn.style.display = 'none';
            } else {
                loadMoreBtn.style.display = 'block';
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = 'Load More';
            }
        } catch (error) {
            console.error('Failed to load anime:', error);
            loadMoreBtn.disabled = false;
            loadMoreBtn.textContent = 'Try Again';
        }

        this.isLoading = false;
    },

    async loadMore() {
        this.currentPage++;
        await this.loadAnimeGrid();
    }
};

window.AnimePage = AnimePage;
