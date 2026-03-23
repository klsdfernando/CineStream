/**
 * Search Page
 */

const SearchPage = {
  searchTimeout: null,
  currentQuery: '',

  async render() {
    const container = document.getElementById('main-content');
    container.innerHTML = `
      <div class="search-page fade-in">
        <div class="search-header">
          <h1 class="search-title">Search</h1>
          <div class="search-input-wrapper">
            <input 
              type="text" 
              class="search-input" 
              id="search-input"
              placeholder="Search for movies and TV shows..."
              autocomplete="off"
            >
            <span class="search-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
            </span>
            <button class="search-clear" id="search-clear">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div id="search-results">
          <div class="search-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <h3>Search for movies and TV shows</h3>
            <p>Enter a title to find what you're looking for</p>
          </div>
        </div>
      </div>
    `;

    // Setup event listeners
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');

    searchInput.addEventListener('input', (e) => {
      this.handleSearch(e.target.value);
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      this.handleSearch('');
      searchInput.focus();
    });

    // Focus on input
    searchInput.focus();
  },

  handleSearch(query) {
    // Clear previous timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.currentQuery = query.trim();

    if (!this.currentQuery) {
      this.showEmptyState();
      return;
    }

    // Debounce search
    this.searchTimeout = setTimeout(() => {
      this.performSearch(this.currentQuery);
    }, 300);
  },

  async performSearch(query) {
    const resultsContainer = document.getElementById('search-results');

    // Show loading
    resultsContainer.innerHTML = `
      <div class="search-loading">
        <div class="loading-spinner"></div>
      </div>
    `;

    try {
      const data = await api.search(query);

      if (data.results?.length === 0) {
        resultsContainer.innerHTML = `
          <div class="search-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M16 16s-1.5-2-4-2-4 2-4 2"/>
              <line x1="9" y1="9" x2="9.01" y2="9"/>
              <line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
            <h3>No results found</h3>
            <p>Try searching with different keywords</p>
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = `
        <div class="search-results-count">
          Found <span>${data.totalResults}</span> results
        </div>
        <div class="search-results-grid" id="search-grid"></div>
      `;

      const grid = document.getElementById('search-grid');
      grid.appendChild(MovieCard.createMultiple(data.results));

    } catch (error) {
      console.error('Search failed:', error);
      resultsContainer.innerHTML = `
        <div class="search-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <h3>Search failed</h3>
          <p>Please check your connection and try again</p>
        </div>
      `;
    }
  },

  showEmptyState() {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = `
      <div class="search-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <h3>Search for movies and TV shows</h3>
        <p>Enter a title to find what you're looking for</p>
      </div>
    `;
  }
};

window.SearchPage = SearchPage;
