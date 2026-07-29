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

    const posterContent = movie.poster
      ? `<img src="${movie.poster}" alt="${movie.title}" loading="lazy">`
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
          <span class="movie-card-year">${movie.year || 'N/A'}</span>
          ${movie.rating ? `
            <span class="movie-card-rating">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              ${movie.rating}
            </span>
          ` : ''}
        </div>
      </div>
    `;

    // Add click handler - navigate to details with media type
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
