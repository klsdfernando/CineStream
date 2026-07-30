/**
 * Search Page Component
 * Featuring instant live auto-suggestions (5-8 items), category filtering,
 * and a rich default grid mixing Movies, TV Series & Anime when idle/not searching.
 */

const SearchPage = {
  searchTimeout: null,
  suggestionTimeout: null,
  currentQuery: '',
  activeFilter: 'all', // 'all', 'movie', 'tv', 'anime'
  allSearchResults: [],
  recommendedMix: [],
  suggestionsData: [],
  activeSuggestionIndex: -1,
  isLoadingRecommendations: false,

  async render() {
    const container = document.getElementById('main-content');
    this.currentQuery = '';
    this.activeFilter = 'all';
    this.allSearchResults = [];
    this.suggestionsData = [];
    this.activeSuggestionIndex = -1;

    container.innerHTML = `
      <div class="search-page fade-in">
        <!-- Search Page Header -->
        <div class="search-header">
          <div class="search-title-container">
            <h1 class="search-title">Discover Movies & Shows</h1>
            <p class="search-subtitle">Search millions of movies, TV series, and anime instantly</p>
          </div>

          <!-- Glassmorphic Search Bar -->
          <div class="search-input-wrapper" id="search-input-wrapper">
            <div class="search-input-inner">
              <span class="search-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
              </span>
              
              <input 
                type="text" 
                class="search-input" 
                id="search-input"
                placeholder="Type to search (e.g. Money Heist, Batman)..."
                autocomplete="off"
                spellcheck="false"
              >

              <div class="search-actions">
                <button class="search-clear" id="search-clear" title="Clear search" aria-label="Clear search">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
                <span class="search-shortcut-badge">ESC</span>
              </div>
            </div>

            <!-- Live Auto-Suggestions Dropdown -->
            <div class="search-suggestions-dropdown" id="search-suggestions-dropdown">
              <div class="suggestions-header">
                <span>Top Suggestions</span>
                <span class="suggestions-hint">Use ↑ ↓ to select, Enter to open</span>
              </div>
              <div class="suggestions-list" id="suggestions-list"></div>
              <div class="suggestions-footer" id="suggestions-footer">
                See all results for "<span id="suggestions-query-text"></span>" →
              </div>
            </div>
          </div>
        </div>

        <!-- Filter Tabs & Result Summary Bar -->
        <div class="search-filter-bar" id="search-filter-bar">
          <div class="search-tabs">
            <button class="search-tab-btn active" data-filter="all">All</button>
            <button class="search-tab-btn" data-filter="movie">Movies</button>
            <button class="search-tab-btn" data-filter="tv">TV Shows</button>
            <button class="search-tab-btn" data-filter="anime">Anime</button>
          </div>
          <div class="search-results-summary" id="search-summary">
            <span>Trending Content</span> (Movies, TV & Anime)
          </div>
        </div>

        <!-- Search Results Grid / Recommended Mix Grid -->
        <div id="search-results">
          ${this.getSkeletonHTML()}
        </div>
      </div>
    `;

    // Initialize Event Listeners
    this.setupEventListeners();

    // Load rich recommended mix for idle state
    await this.loadRecommendedContent();
  },

  async loadRecommendedContent() {
    this.isLoadingRecommendations = true;
    try {
      const [moviesData, tvData, animeData] = await Promise.all([
        api.movies.getTrending('day').catch(() => ({ results: [] })),
        api.tv.getTrending().catch(() => ({ results: [] })),
        api.anime.getTrending().catch(() => ({ results: [] }))
      ]);

      const movies = (moviesData.results || []).map(m => ({ ...m, mediaType: 'movie' }));
      const tvSeries = (tvData.results || []).map(t => ({ ...t, mediaType: 'tv' }));
      const anime = (animeData.results || []).map(a => ({ ...a, mediaType: 'tv', isAnime: true }));

      // Interleave movies, tv series, and anime into a balanced mix
      const mix = [];
      const maxLength = Math.max(movies.length, tvSeries.length, anime.length);
      for (let i = 0; i < maxLength; i++) {
        if (i < movies.length) mix.push(movies[i]);
        if (i < tvSeries.length) mix.push(tvSeries[i]);
        if (i < anime.length) mix.push(anime[i]);
      }

      this.recommendedMix = mix;
      this.isLoadingRecommendations = false;

      // If user hasn't typed anything yet, display this recommended mix
      if (!this.currentQuery) {
        this.renderFilteredResults();
      }
    } catch (error) {
      console.error('Failed to load recommended mix:', error);
      this.isLoadingRecommendations = false;
      if (!this.currentQuery) {
        const container = document.getElementById('search-results');
        if (container) {
          container.innerHTML = `
            <div class="search-empty">
              <h3>Discover Content</h3>
              <p>Type in the search box above to find movies, TV shows, and anime.</p>
            </div>
          `;
        }
      }
    }
  },

  setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    const wrapper = document.getElementById('search-input-wrapper');
    const footer = document.getElementById('suggestions-footer');

    if (!searchInput) return;

    // Input Typing Handler
    searchInput.addEventListener('input', (e) => {
      this.handleInput(e.target.value);
    });

    // Input Focus Handler
    searchInput.addEventListener('focus', () => {
      if (this.suggestionsData.length > 0 && searchInput.value.trim().length >= 2) {
        this.showSuggestionsDropdown();
      }
    });

    // Keyboard Navigation for Suggestions & Search
    searchInput.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    // Clear Button Handler
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      this.currentQuery = '';
      this.hideSuggestionsDropdown();
      this.renderFilteredResults();
      searchInput.focus();
    });

    // Footer Click Handler ("See all results")
    if (footer) {
      footer.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) {
          this.hideSuggestionsDropdown();
          this.performFullSearch(query);
        }
      });
    }

    // Filter Tabs Click Handlers
    document.querySelectorAll('.search-tab-btn').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.search-tab-btn').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeFilter = tab.dataset.filter;
        this.renderFilteredResults();
      });
    });

    // Close Dropdown on Click Outside
    this.clickOutsideHandler = (e) => {
      if (wrapper && !wrapper.contains(e.target)) {
        this.hideSuggestionsDropdown();
      }
    };
    document.addEventListener('click', this.clickOutsideHandler);

    // Auto Focus Input
    searchInput.focus();
  },

  handleInput(rawQuery) {
    const query = rawQuery.trim();
    this.currentQuery = query;

    if (!query) {
      this.hideSuggestionsDropdown();
      this.renderFilteredResults();
      return;
    }

    // Debounce Live Auto-Suggestions Fetch (180ms)
    if (this.suggestionTimeout) clearTimeout(this.suggestionTimeout);
    this.suggestionTimeout = setTimeout(() => {
      if (query.length >= 2) {
        this.fetchAutoSuggestions(query);
      } else {
        this.hideSuggestionsDropdown();
      }
    }, 180);

    // Debounce Full Grid Search Update (350ms)
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      if (query.length >= 2) {
        this.performFullSearch(query);
      }
    }, 350);
  },

  async fetchAutoSuggestions(query) {
    const listContainer = document.getElementById('suggestions-list');
    const footerText = document.getElementById('suggestions-query-text');
    if (!listContainer) return;

    if (footerText) footerText.textContent = query;

    try {
      const data = await api.search(query, 1);
      const rawResults = data?.results || [];

      // Filter and limit to top 5 to 8 suggestions
      const suggestions = rawResults.slice(0, 8);
      this.suggestionsData = suggestions;
      this.activeSuggestionIndex = -1;

      if (suggestions.length === 0) {
        this.hideSuggestionsDropdown();
        return;
      }

      this.renderSuggestions(query, suggestions);
      this.showSuggestionsDropdown();
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      this.hideSuggestionsDropdown();
    }
  },

  renderSuggestions(query, suggestions) {
    const listContainer = document.getElementById('suggestions-list');
    if (!listContainer) return;

    listContainer.innerHTML = suggestions.map((item, index) => {
      const isTV = item.mediaType === 'tv';
      const isAnime = item.isAnime || item.originalLanguage === 'ja' || (item.genreIds && item.genreIds.includes(16));
      let badgeClass = 'movie';
      let badgeLabel = 'Movie';

      if (isAnime) {
        badgeClass = 'anime';
        badgeLabel = 'Anime';
      } else if (isTV) {
        badgeClass = 'tv';
        badgeLabel = 'TV';
      }

      const posterUrl = item.posterSmall || item.poster || item.backdrop;
      const year = item.year || (item.releaseDate ? new Date(item.releaseDate).getFullYear() : '');
      const rating = item.rating ? Number(item.rating).toFixed(1) : null;
      const highlightedTitle = this.highlightMatch(item.title, query);

      const posterHTML = posterUrl
        ? `<img src="${posterUrl}" alt="${item.title}" class="suggestion-poster" loading="lazy">`
        : `<div class="suggestion-poster-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
              <line x1="7" y1="2" x2="7" y2="22"/>
            </svg>
          </div>`;

      return `
        <div class="suggestion-item ${index === this.activeSuggestionIndex ? 'active' : ''}" data-index="${index}">
          ${posterHTML}
          <div class="suggestion-info">
            <div class="suggestion-title">${highlightedTitle}</div>
            <div class="suggestion-meta">
              <span class="suggestion-badge ${badgeClass}">${badgeLabel}</span>
              ${year ? `<span class="suggestion-year">${year}</span>` : ''}
              ${rating ? `
                <span class="suggestion-rating">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  ${rating}
                </span>
              ` : ''}
            </div>
          </div>
          <span class="suggestion-arrow">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </span>
        </div>
      `;
    }).join('');

    // Attach click events to suggestion items
    listContainer.querySelectorAll('.suggestion-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index, 10);
        this.selectSuggestion(idx);
      });
    });
  },

  highlightMatch(text, query) {
    if (!text || !query) return text || '';
    const regex = new RegExp(`(${this.escapeRegExp(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  },

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  handleKeyDown(e) {
    const dropdown = document.getElementById('search-suggestions-dropdown');
    const isDropdownVisible = dropdown && dropdown.classList.contains('visible');

    if (e.key === 'Escape') {
      this.hideSuggestionsDropdown();
      return;
    }

    if (isDropdownVisible && this.suggestionsData.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.activeSuggestionIndex = Math.min(this.activeSuggestionIndex + 1, this.suggestionsData.length - 1);
        this.updateActiveSuggestionItem();
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.activeSuggestionIndex = Math.max(this.activeSuggestionIndex - 1, -1);
        this.updateActiveSuggestionItem();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.activeSuggestionIndex >= 0 && this.activeSuggestionIndex < this.suggestionsData.length) {
          this.selectSuggestion(this.activeSuggestionIndex);
        } else {
          const inputVal = e.target.value.trim();
          if (inputVal) {
            this.hideSuggestionsDropdown();
            this.performFullSearch(inputVal);
          }
        }
        return;
      }
    } else if (e.key === 'Enter') {
      const inputVal = e.target.value.trim();
      if (inputVal) {
        this.hideSuggestionsDropdown();
        this.performFullSearch(inputVal);
      }
    }
  },

  updateActiveSuggestionItem() {
    const items = document.querySelectorAll('.suggestion-item');
    items.forEach((item, idx) => {
      if (idx === this.activeSuggestionIndex) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  },

  selectSuggestion(index) {
    const item = this.suggestionsData[index];
    if (!item) return;

    this.hideSuggestionsDropdown();
    if (window.router) {
      router.navigate('details', { id: item.id, mediaType: item.mediaType || 'movie' });
    }
  },

  showSuggestionsDropdown() {
    const dropdown = document.getElementById('search-suggestions-dropdown');
    if (dropdown) dropdown.classList.add('visible');
  },

  hideSuggestionsDropdown() {
    const dropdown = document.getElementById('search-suggestions-dropdown');
    if (dropdown) dropdown.classList.remove('visible');
    this.activeSuggestionIndex = -1;
  },

  async performFullSearch(query) {
    const resultsContainer = document.getElementById('search-results');
    const summary = document.getElementById('search-summary');
    if (!resultsContainer) return;

    // Show Skeleton Loader
    resultsContainer.innerHTML = this.getSkeletonHTML();

    try {
      const data = await api.search(query, 1);
      this.allSearchResults = data?.results || [];

      if (this.allSearchResults.length === 0) {
        if (summary) summary.innerHTML = `No results found for "<span>${query}</span>"`;
        resultsContainer.innerHTML = `
          <div class="search-empty">
            <div class="search-empty-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </div>
            <h3>No results found for "${query}"</h3>
            <p>Try searching with different keywords, movie titles, or check for typos.</p>
          </div>
        `;
        return;
      }

      this.renderFilteredResults();

    } catch (error) {
      console.error('Full search failed:', error);
      resultsContainer.innerHTML = `
        <div class="search-empty">
          <div class="search-empty-icon-wrapper" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3);">
            <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h3>Search Connection Failed</h3>
          <p>Please check your network connection and try searching again.</p>
        </div>
      `;
    }
  },

  renderFilteredResults() {
    const resultsContainer = document.getElementById('search-results');
    const summary = document.getElementById('search-summary');
    if (!resultsContainer) return;

    const isSearching = !!this.currentQuery;
    const dataSource = isSearching ? this.allSearchResults : this.recommendedMix;

    let filtered = dataSource;
    if (this.activeFilter === 'movie') {
      filtered = dataSource.filter(item => item.mediaType === 'movie');
    } else if (this.activeFilter === 'tv') {
      filtered = dataSource.filter(item => item.mediaType === 'tv' && !item.isAnime);
    } else if (this.activeFilter === 'anime') {
      filtered = dataSource.filter(item => 
        item.isAnime || item.originalLanguage === 'ja' || (item.genreIds && item.genreIds.includes(16))
      );
    }

    if (summary) {
      if (isSearching) {
        summary.innerHTML = `Found <span>${filtered.length}</span> ${this.activeFilter === 'all' ? 'total' : this.activeFilter} result${filtered.length === 1 ? '' : 's'} for "<span>${this.currentQuery}</span>"`;
      } else {
        const catLabel = this.activeFilter === 'all' ? 'Movies, TV & Anime' : this.activeFilter.toUpperCase();
        summary.innerHTML = `Trending Content (<span>${catLabel}</span>)`;
      }
    }

    if (filtered.length === 0) {
      if (this.isLoadingRecommendations && !isSearching) {
        resultsContainer.innerHTML = this.getSkeletonHTML();
        return;
      }
      resultsContainer.innerHTML = `
        <div class="search-empty">
          <h3>No ${this.activeFilter} titles available</h3>
          <p>Try switching to another category tab.</p>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = `<div class="search-results-grid" id="search-grid"></div>`;
    const grid = document.getElementById('search-grid');
    if (grid && window.MovieCard) {
      grid.appendChild(MovieCard.createMultiple(filtered));
    }
  },

  getSkeletonHTML() {
    const items = Array(12).fill(0);
    return `
      <div class="search-skeleton-grid">
        ${items.map(() => `
          <div class="skeleton-card">
            <div class="skeleton-poster"></div>
            <div class="skeleton-body">
              <div class="skeleton-line"></div>
              <div class="skeleton-line short"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
};

window.SearchPage = SearchPage;
