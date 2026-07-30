/**
 * Movie Card Component
 */

const MovieCard = {
  /**
   * Create a movie card element
   * @param {Object} movie - Movie data
   * @returns {HTMLElement}
   */
  create(movie) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.dataset.movieId = movie.id;
    card.dataset.mediaType = movie.mediaType || 'movie';

    const isTV = movie.mediaType === 'tv';
    const posterUrl = movie.poster || movie.posterSmall || movie.backdrop || '';
    const bannerUrl = movie.backdrop || movie.backdropOriginal || movie.poster || '';
    const bgPoster = movie.poster || movie.backdrop || '';
    const overviewText = movie.overview || movie.description || 'No description available.';
    const yearVal = movie.year || (movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : 'N/A');
    const ratingVal = movie.rating ? Number(movie.rating).toFixed(1) : null;

    const posterContent = posterUrl
      ? `<img src="${posterUrl}" alt="${movie.title}" loading="lazy" class="movie-card-img">`
      : `<div class="poster-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
            <line x1="7" y1="2" x2="7" y2="22"/>
            <line x1="17" y1="2" x2="17" y2="22"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <line x1="2" y1="7" x2="7" y2="7"/>
            <line x1="2" y1="17" x2="7" y2="17"/>
            <line x1="17" y1="17" x2="22" y2="17"/>
            <line x1="17" y1="7" x2="22" y2="7"/>
          </svg>
        </div>`;

    card.innerHTML = `
      <div class="movie-card-poster">
        ${posterContent}
        ${isTV ? '<span class="media-type-badge tv">TV</span>' : ''}
      </div>

      <div class="movie-card-info">
        <h3 class="movie-card-title">${movie.title}</h3>
        <div class="movie-card-meta">
          <span class="movie-card-year">${yearVal}</span>
          ${ratingVal ? `
            <span class="movie-card-rating">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              ${ratingVal}
            </span>
          ` : ''}
        </div>
      </div>

      <!-- Expanded Wider Pop-Out Hover Card -->
      <div class="movie-card-popout">
        <!-- Top 16:9 Banner Header (Single Crisp Image) -->
        <div class="popout-banner">
          ${bannerUrl ? `<img src="${bannerUrl}" alt="${movie.title}" class="popout-banner-img">` : ''}
          <div class="popout-banner-gradient"></div>
          <span class="popout-badge ${isTV ? 'tv' : 'movie'}">${isTV ? 'TV Series' : 'Movie'}</span>
          <div class="popout-play-btn" title="Watch Now">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
        </div>

        <!-- Popout Body Details -->
        <div class="popout-body">
          <h4 class="popout-title">${movie.title}</h4>
          
          <div class="popout-meta">
            <span class="popout-year">${yearVal}</span>
            ${ratingVal ? `
              <span class="popout-rating">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                ${ratingVal}
              </span>
            ` : ''}
            <span class="popout-quality">HD</span>
          </div>

          <p class="popout-description">${overviewText}</p>

          <div class="popout-actions">
            <button type="button" class="popout-btn-play">
              <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Watch
            </button>
            <button type="button" class="popout-btn-info">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              Details
            </button>
          </div>
        </div>
      </div>
    `;

    // Watch button click handler - direct to player page
    const playBtn = card.querySelector('.popout-btn-play');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        router.navigate('watch', { id: movie.id, mediaType: movie.mediaType || 'movie' });
      });
    }

    const popoutPlayCircle = card.querySelector('.popout-play-btn');
    if (popoutPlayCircle) {
      popoutPlayCircle.addEventListener('click', (e) => {
        e.stopPropagation();
        router.navigate('watch', { id: movie.id, mediaType: movie.mediaType || 'movie' });
      });
    }

    // Default card click handler - navigate to details page
    card.addEventListener('click', () => {
      router.navigate('details', { id: movie.id, mediaType: movie.mediaType || 'movie' });
    });

    return card;
  },

  /**
   * Create multiple movie cards
   * @param {Array} movies - Array of movie data
   * @returns {DocumentFragment}
   */
  createMultiple(movies) {
    const fragment = document.createDocumentFragment();
    movies.forEach(movie => {
      fragment.appendChild(this.create(movie));
    });
    return fragment;
  }
};

window.MovieCard = MovieCard;
