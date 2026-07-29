/**
 * Discover Page
 */

const DiscoverPage = {
    genres: [],
    currentPage: 1,
    currentFilters: {
        genre: '',
        sortBy: 'popularity.desc',
        year: ''
    },
    isLoading: false,

    async render() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
      <div class="discover-page fade-in">
        <div class="discover-header">
          <h1 class="discover-title">Discover</h1>
          <p class="discover-subtitle">Explore movies by genre, year, and more</p>
        </div>

        <div class="discover-filters">
          <div class="filter-group">
            <label class="filter-label">Sort By</label>
            <select class="filter-select" id="filter-sort">
              <option value="popularity.desc">Most Popular</option>
              <option value="vote_average.desc">Highest Rated</option>
              <option value="release_date.desc">Newest First</option>
              <option value="release_date.asc">Oldest First</option>
              <option value="revenue.desc">Highest Revenue</option>
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Year</label>
            <select class="filter-select" id="filter-year">
              <option value="">All Years</option>
              ${this.generateYearOptions()}
            </select>
          </div>
        </div>

        <div class="discover-genres" id="genre-buttons">
          <button class="genre-btn active" data-genre="">All Genres</button>
        </div>

        <div class="discover-grid" id="discover-grid"></div>
        
        <div class="load-more-container">
          <button class="load-more-btn" id="load-more-btn">Load More</button>
        </div>
      </div>
    `;

        // Load genres
        await this.loadGenres();

        // Setup event listeners
        this.setupEventListeners();

        // Initial load
        await this.loadMovies();
    },

    generateYearOptions() {
        const currentYear = new Date().getFullYear();
        let options = '';
        for (let year = currentYear; year >= 1950; year--) {
            options += `<option value="${year}">${year}</option>`;
        }
        return options;
    },

    async loadGenres() {
        try {
            this.genres = await api.getGenres();
            const container = document.getElementById('genre-buttons');

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

    setupEventListeners() {
        // Sort filter
        document.getElementById('filter-sort').addEventListener('change', (e) => {
            this.currentFilters.sortBy = e.target.value;
            this.resetAndLoad();
        });

        // Year filter
        document.getElementById('filter-year').addEventListener('change', (e) => {
            this.currentFilters.year = e.target.value;
            this.resetAndLoad();
        });

        // All genres button
        document.querySelector('.genre-btn[data-genre=""]').addEventListener('click', (e) => {
            this.selectGenre('', e.target);
        });

        // Load more button
        document.getElementById('load-more-btn').addEventListener('click', () => {
            this.loadMore();
        });
    },

    selectGenre(genreId, btn) {
        // Update active state
        document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update filter
        this.currentFilters.genre = genreId;
        this.resetAndLoad();
    },

    async resetAndLoad() {
        this.currentPage = 1;
        const grid = document.getElementById('discover-grid');
        grid.innerHTML = '';
        await this.loadMovies();
    },

    async loadMovies() {
        if (this.isLoading) return;
        this.isLoading = true;

        const grid = document.getElementById('discover-grid');
        const loadMoreBtn = document.getElementById('load-more-btn');
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'Loading...';

        try {
            const data = await api.discover({
                page: this.currentPage,
                sortBy: this.currentFilters.sortBy,
                genre: this.currentFilters.genre,
                year: this.currentFilters.year
            });

            if (data.results?.length > 0) {
                grid.appendChild(MovieCard.createMultiple(data.results));
            }

            // Update load more button
            if (this.currentPage >= data.totalPages) {
                loadMoreBtn.style.display = 'none';
            } else {
                loadMoreBtn.style.display = 'block';
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = 'Load More';
            }

        } catch (error) {
            console.error('Failed to load movies:', error);
            loadMoreBtn.disabled = false;
            loadMoreBtn.textContent = 'Try Again';
        }

        this.isLoading = false;
    },

    async loadMore() {
        this.currentPage++;
        await this.loadMovies();
    }
};

window.DiscoverPage = DiscoverPage;
