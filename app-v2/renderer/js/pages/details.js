/**
 * Details Page - Movie and TV Series
 */

const DetailsPage = {
  mediaType: 'movie',
  mediaId: null,
  images: null,

  async render(params) {
    const { id, mediaType = 'movie' } = params;
    this.mediaType = mediaType;
    this.mediaId = id;

    const container = document.getElementById('main-content');
    const isTV = mediaType === 'tv';

    // Show loading
    container.innerHTML = `
      <div class="loading-screen">
        <div class="loading-spinner"></div>
        <p>Loading ${isTV ? 'TV series' : 'movie'} details...</p>
      </div>
    `;

    try {
      if (isTV) {
        await this.renderTVDetails(id, container);
      } else {
        await this.renderMovieDetails(id, container);
      }
    } catch (error) {
      console.error('Failed to load details:', error);
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>Failed to load details. Please try again.</p>
          <button class="btn btn-outline" onclick="router.navigate('home')">Go Home</button>
        </div>
      `;
    }
  },

  async renderMovieDetails(id, container) {
    // Load all movie data in parallel
    const [movie, credits, images, videos, similar] = await Promise.all([
      api.movies.getDetails(id),
      api.movies.getCredits(id),
      api.movies.getImages(id),
      api.movies.getVideos(id),
      api.movies.getSimilar(id)
    ]);

    // Store images for lightbox
    this.images = images;

    // Find trailer
    const trailer = videos.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
    // Find movie logo
    const logo = images.logos?.[0]?.path;

    this.renderContent(container, movie, credits, images, trailer, logo, similar, 'movie');
  },

  async renderTVDetails(id, container) {
    // Load TV series data
    const [show, credits, similar] = await Promise.all([
      api.tv.getDetails(id),
      api.tv.getCredits(id),
      api.tv.getSimilar(id)
    ]);

    // TV shows don't have images endpoint in our API yet, so pass empty
    this.images = { backdrops: [], posters: [] };

    this.renderContent(container, show, credits, this.images, null, null, similar, 'tv');
  },

  renderContent(container, media, credits, images, trailer, logo, similar, mediaType) {
    const isTV = mediaType === 'tv';
    const backdrops = images?.backdrops?.slice(0, 8) || [];

    container.innerHTML = `
        <div class="details-page fade-in">
          <!-- Back Button -->
          <button class="back-button" id="back-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>

          <!-- Hero Section -->
          <div class="details-hero">
            ${media.backdrop ? `
              <img class="details-backdrop" src="${media.backdrop}" alt="${media.title}">
            ` : ''}
            <div class="details-backdrop-overlay"></div>
            <div class="details-hero-content">
              ${logo ? `
                <img class="details-logo" src="${logo}" alt="${media.title}">
              ` : `
                <h1 class="details-title-fallback">${media.title}</h1>
              `}
            </div>
          </div>

          <!-- Content Section -->
          <div class="details-content">
            <div class="details-info">
              <!-- Poster -->
              <div class="details-poster">
                ${media.poster ? `
                  <img src="${media.posterLarge || media.poster}" alt="${media.title}">
                ` : `
                  <div class="poster-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                      <line x1="7" y1="2" x2="7" y2="22"/>
                      <line x1="17" y1="2" x2="17" y2="22"/>
                    </svg>
                  </div>
                `}
              </div>

              <!-- Meta Info -->
              <div class="details-meta">
                <span class="badge details-badge ${isTV ? 'tv-badge' : ''}">${isTV ? 'TV Series' : 'Movie'}</span>
                <h1 class="details-title">${media.title}</h1>
                
                <div class="details-meta-row">
                  ${!isTV && media.runtimeFormatted ? `
                    <span class="details-meta-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      ${media.runtimeFormatted}
                    </span>
                  ` : ''}
                  ${isTV && media.numberOfSeasons ? `
                    <span class="details-meta-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                        <path d="M2 8h20"/>
                      </svg>
                      ${media.numberOfSeasons} Seasons
                    </span>
                  ` : ''}
                  ${media.year ? `
                    <span class="details-meta-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      ${media.year}
                    </span>
                  ` : ''}
                  ${media.rating ? `
                    <span class="details-meta-item rating">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      ${media.rating}
                    </span>
                  ` : ''}
                  ${media.status ? `
                    <span class="details-meta-item status">
                      ${media.status}
                    </span>
                  ` : ''}
                </div>

                <!-- Genres -->
                <div class="details-genres">
                  ${media.genres?.map(g => `<span class="genre-pill">${g.name}</span>`).join('') || ''}
                </div>

                <!-- Action Buttons -->
                <div class="details-actions">
                  <button class="btn btn-primary" id="play-btn">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    ${isTV ? 'Watch Now' : 'Play Now'}
                  </button>
                  ${trailer ? `
                    <button class="btn btn-outline" id="trailer-btn" data-url="${trailer.embedUrl}">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/>
                        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="white"/>
                      </svg>
                      Trailer
                    </button>
                  ` : ''}
                  <button class="icon-btn" id="btn-share-details" title="Share">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="18" cy="5" r="3"/>
                      <circle cx="6" cy="12" r="3"/>
                      <circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                  </button>
                  <button class="icon-btn" id="btn-bookmark-details" title="Bookmark">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                  </button>
                </div>

                <!-- Story Line -->
                ${media.overview ? `
                  <div class="details-storyline">
                    <h3>Story Line</h3>
                    <p>${media.overview}</p>
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- Cast Section -->
            ${credits.cast?.length > 0 ? `
              <div class="details-section">
                <h3 class="section-title">Top Cast</h3>
                <div class="cast-row">
                  ${credits.cast.slice(0, 10).map(person => `
                    <div class="cast-card clickable" data-person-id="${person.id}">
                      ${person.profileImage ? `
                        <img src="${person.profileImage}" alt="${person.name}">
                      ` : `
                        <div class="cast-placeholder">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                        </div>
                      `}
                      <div class="cast-info">
                        <span class="cast-name">${person.name}</span>
                        <span class="cast-character">${person.character}</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Photos Section -->
            ${backdrops.length > 0 ? `
              <div class="details-section">
                <h3 class="section-title">Photos</h3>
                <div class="photos-grid">
                  ${backdrops.map((img, index) => `
                    <div class="photo-card" data-index="${index}" data-src="${img.path}">
                      <img src="${img.path}" alt="Photo ${index + 1}" loading="lazy">
                      <div class="photo-overlay">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="11" cy="11" r="8"/>
                          <path d="M21 21l-4.35-4.35"/>
                          <line x1="11" y1="8" x2="11" y2="14"/>
                          <line x1="8" y1="11" x2="14" y2="11"/>
                        </svg>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Similar Section -->
            <div class="details-section">
              <h3 class="section-title">More Like This</h3>
              <div class="movie-grid-horizontal" id="similar-movies"></div>
            </div>
          </div>
        </div>

        <!-- Image Lightbox -->
        <div class="lightbox" id="lightbox">
          <button class="lightbox-close" id="lightbox-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <div class="lightbox-content">
            <img id="lightbox-img" src="" alt="Full size image">
          </div>
          <button class="lightbox-nav lightbox-prev" id="lightbox-prev">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <button class="lightbox-nav lightbox-next" id="lightbox-next">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      `;

    this.attachEventListeners(similar, isTV, backdrops);
  },

  async attachEventListeners(similar, isTV, backdrops) {
    // Back button
    document.getElementById('back-btn').addEventListener('click', () => {
      router.back();
    });

    // Add similar items with proper mediaType, or fetch trending if empty
    const similarContainer = document.getElementById('similar-movies');

    if (similar.results?.length > 0) {
      const similarWithType = similar.results.slice(0, 10).map(item => ({
        ...item,
        mediaType: isTV ? 'tv' : 'movie'
      }));
      similarContainer.appendChild(MovieCard.createMultiple(similarWithType));
    } else {
      // Fetch trending as fallback and show random selection
      try {
        const trending = await api.movies.getTrending();
        if (trending.results?.length > 0) {
          // Shuffle and pick random 10
          const shuffled = trending.results.sort(() => Math.random() - 0.5);
          const randomSelection = shuffled.slice(0, 10).map(item => ({
            ...item,
            mediaType: item.mediaType || 'movie'
          }));
          similarContainer.appendChild(MovieCard.createMultiple(randomSelection));
        }
      } catch (error) {
        console.error('Failed to fetch trending for fallback:', error);
      }
    }

    // Trailer button
    const trailerBtn = document.getElementById('trailer-btn');
    if (trailerBtn) {
      trailerBtn.addEventListener('click', () => {
        const url = trailerBtn.dataset.url;
        window.open(url, '_blank');
      });
    }

    // Play Now button
    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        router.navigate('watch', { id: this.mediaId, mediaType: this.mediaType });
      });
    }

    // Share and Bookmark buttons (Mocked for graceful degradation)
    document.getElementById('btn-share-details')?.addEventListener('click', () => {
      api.showUnderDevelopmentToast();
    });

    document.getElementById('btn-bookmark-details')?.addEventListener('click', () => {
      api.showUnderDevelopmentToast();
    });

    // Cast card clicks - navigate to person profile
    const castCards = document.querySelectorAll('.cast-card.clickable');
    castCards.forEach(card => {
      card.addEventListener('click', () => {
        const personId = card.dataset.personId;
        if (personId) {
          router.navigate('person', { id: parseInt(personId) });
        }
      });
    });

    // Photo lightbox
    this.setupLightbox(backdrops);
  },

  setupLightbox(backdrops) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');
    let currentIndex = 0;

    // Open lightbox on photo click
    const photoCards = document.querySelectorAll('.photo-card');
    photoCards.forEach(card => {
      card.addEventListener('click', () => {
        currentIndex = parseInt(card.dataset.index);
        lightboxImg.src = card.dataset.src;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    });

    // Close lightbox
    const closeLightbox = () => {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
    };

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) {
        closeLightbox();
      }
    });

    // Navigate photos
    lightboxPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      currentIndex = (currentIndex - 1 + backdrops.length) % backdrops.length;
      lightboxImg.src = backdrops[currentIndex].path;
    });

    lightboxNext.addEventListener('click', (e) => {
      e.stopPropagation();
      currentIndex = (currentIndex + 1) % backdrops.length;
      lightboxImg.src = backdrops[currentIndex].path;
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('active')) return;

      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') {
        currentIndex = (currentIndex - 1 + backdrops.length) % backdrops.length;
        lightboxImg.src = backdrops[currentIndex].path;
      }
      if (e.key === 'ArrowRight') {
        currentIndex = (currentIndex + 1) % backdrops.length;
        lightboxImg.src = backdrops[currentIndex].path;
      }
    });
  }
};

window.DetailsPage = DetailsPage;
