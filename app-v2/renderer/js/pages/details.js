/**
 * Details Page - Movie and TV Series
 * Inspired by reference design layout with CineStream light-green aesthetic
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

    // Show loading screen
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
    const [movie, credits, images, videos, similar] = await Promise.all([
      api.movies.getDetails(id),
      api.movies.getCredits(id),
      api.movies.getImages(id),
      api.movies.getVideos(id),
      api.movies.getSimilar(id)
    ]);

    this.images = images;

    const trailer = videos.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos.results?.[0];
    const logo = images.logos?.[0]?.path;

    this.renderContent(container, movie, credits, images, trailer, logo, similar, 'movie');
  },

  async renderTVDetails(id, container) {
    const [show, credits, similar] = await Promise.all([
      api.tv.getDetails(id),
      api.tv.getCredits(id),
      api.tv.getSimilar(id)
    ]);

    this.images = { backdrops: [], posters: [] };

    this.renderContent(container, show, credits, this.images, null, null, similar, 'tv');
  },

  renderContent(container, media, credits, images, trailer, logo, similar, mediaType) {
    const isTV = mediaType === 'tv';
    const backdrops = images?.backdrops?.slice(0, 6) || [];

    // Extract Directors & Writers or Creators
    const director = credits.crew?.find(c => c.job === 'Director')?.name || media.createdBy?.map(c => c.name).join(', ') || 'N/A';
    const writers = credits.crew?.filter(c => c.department === 'Writing')?.map(c => c.name).slice(0, 2).join(', ') || 'N/A';
    const productionCountries = media.productionCompanies?.map(c => c.name).slice(0, 2).join(', ') || 'USA';
    const language = media.originalLanguage ? media.originalLanguage.toUpperCase() : 'English';
    const releaseDateFormatted = media.releaseDate || media.firstAirDate || (media.year ? String(media.year) : 'N/A');

    const backdropUrl = media.backdrop || media.poster || '';
    const posterUrl = media.posterLarge || media.poster || media.backdrop || '';

    container.innerHTML = `
      <div class="details-page fade-in">
        <!-- Floating Back Button (Positioned safely below topnav) -->
        <button class="back-button" id="back-btn" title="Go Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>

        <!-- 1. Hero Banner Section -->
        <div class="details-hero">
          ${backdropUrl ? `<img class="details-backdrop" src="${backdropUrl}" alt="${media.title}">` : ''}
          <div class="details-backdrop-overlay"></div>

          <!-- Hero Centered Play Button -->
          <div class="hero-center-play-btn" id="hero-play-btn" title="Watch Now">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>

          <!-- Hero Bottom Right Quick Actions (Aligned with 3-column container) -->
          <div class="hero-bottom-overlay">
            <div class="hero-bottom-container">
              <div class="hero-quick-actions">
                ${media.rating ? `
                  <div class="hero-action-pill rating-pill">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    IMDb ${media.rating}
                  </div>
                ` : ''}

                <button class="hero-action-pill" id="btn-watchlist-pill">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Watchlist
                </button>

                <button class="hero-action-pill" id="btn-share-pill">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2">
                    <circle cx="18" cy="5" r="3"/>
                    <circle cx="6" cy="12" r="3"/>
                    <circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  Share
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Main 3-Column Content Grid -->
        <div class="details-content-grid">
          
          <!-- Column 1: Poster & Stacked Action Buttons -->
          <div class="details-col-poster">
            <div class="details-poster-wrap">
              ${posterUrl ? `
                <img src="${posterUrl}" alt="${media.title}" class="details-poster-img">
              ` : `
                <div class="poster-placeholder-box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="2" width="20" height="20" rx="2"/>
                    <line x1="7" y1="2" x2="7" y2="22"/>
                    <line x1="17" y1="2" x2="17" y2="22"/>
                  </svg>
                </div>
              `}
            </div>

            <div class="details-left-actions">
              <button class="btn-action-primary" id="left-play-btn">
                <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                ${isTV ? 'Watch Series' : 'Watch Movie'}
              </button>

              <button class="btn-action-secondary" id="btn-add-list">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add To Playlist
              </button>

              ${trailer ? `
                <button class="btn-action-secondary" id="btn-left-trailer" data-url="${trailer.embedUrl}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  Play Trailer
                </button>
              ` : ''}

              <button class="btn-action-secondary" id="btn-left-report">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                  <line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
                Report Issue
              </button>
            </div>
          </div>

          <!-- Column 2: Details, Cast & Storyline -->
          <div class="details-col-main">
            <!-- Title & Header -->
            <div class="details-main-header">
              <h1 class="details-main-title">
                ${media.title} 
                ${media.year ? `<span class="details-year-tag">(${media.year})</span>` : ''}
              </h1>

              ${media.tagline ? `<div class="details-tagline">"${media.tagline}"</div>` : ''}
              
              <div class="details-stats-bar">
                ${media.rating ? `
                  <span class="stat-badge rating-badge">
                    <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    ${media.rating}
                  </span>
                ` : ''}

                ${media.voteCount ? `<span class="stat-badge">(${media.voteCount.toLocaleString()} votes)</span>` : ''}

                ${!isTV && media.runtimeFormatted ? `<span class="stat-badge">${media.runtimeFormatted}</span>` : ''}
                ${isTV && media.numberOfSeasons ? `<span class="stat-badge">${media.numberOfSeasons} Seasons</span>` : ''}

                ${media.genres?.map(g => `<span class="stat-badge genre-badge">${g.name}</span>`).join('') || ''}
              </div>
            </div>

            <!-- Key-Value Details Grid -->
            <div class="details-info-section">
              <h3 class="section-subheading">Details</h3>
              <div class="details-kv-grid">
                <div class="kv-item">
                  <span class="kv-label">${isTV ? 'Creators' : 'Director'}</span>
                  <span class="kv-value">${director}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">Writers / Studio</span>
                  <span class="kv-value">${writers}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">Country</span>
                  <span class="kv-value">${productionCountries}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">Language</span>
                  <span class="kv-value">${language}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">Release Date</span>
                  <span class="kv-value">${releaseDateFormatted}</span>
                </div>
              </div>
            </div>

            <!-- Cast Avatars Section -->
            ${credits.cast?.length > 0 ? `
              <div class="details-cast-section">
                <h3 class="section-subheading">Cast</h3>
                <div class="cast-avatars-grid">
                  ${credits.cast.slice(0, 8).map(person => `
                    <div class="cast-avatar-item clickable" data-person-id="${person.id}">
                      ${person.profileImage ? `
                        <img src="${person.profileImage}" alt="${person.name}" class="cast-avatar-img" loading="lazy">
                      ` : `
                        <div class="cast-avatar-placeholder">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                        </div>
                      `}
                      <div class="cast-avatar-info">
                        <span class="cast-avatar-name">${person.name}</span>
                        <span class="cast-avatar-character">${person.character || 'Cast'}</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Storyline Section -->
            ${media.overview ? `
              <div class="details-storyline-section">
                <h3 class="section-subheading">Storyline</h3>
                <p class="storyline-text">${media.overview}</p>
              </div>
            ` : ''}
          </div>

          <!-- Column 3: Right Gallery & Trailers Section -->
          <div class="details-col-right">
            <div class="gallery-card">
              <h3 class="gallery-card-title">Gallery & Trailer</h3>

              <!-- Trailer Preview Box -->
              ${trailer ? `
                <div class="trailer-preview-box" id="right-trailer-box" data-url="${trailer.embedUrl}">
                  <img src="${trailer.thumbnailUrl || backdropUrl}" alt="Trailer Preview" class="trailer-preview-img">
                  <div class="trailer-play-overlay">
                    <div class="trailer-play-icon">
                      <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                  </div>
                </div>
              ` : ''}

              <!-- Photo Thumbnails Grid -->
              ${backdrops.length > 0 ? `
                <div class="gallery-photos-grid">
                  ${backdrops.map((img, index) => `
                    <div class="gallery-photo-thumb" data-index="${index}" data-src="${img.path}">
                      <img src="${img.path}" alt="Photo ${index + 1}" loading="lazy">
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- 3. Bottom Section: Similar Movies -->
        <div class="details-bottom-section">
          <div class="details-bottom-header">
            <h2 class="details-bottom-title">Similar Content</h2>
          </div>
          <div class="similar-movies-container">
            <div class="movie-grid-horizontal" id="similar-movies"></div>
          </div>
        </div>
      </div>

      <!-- Image Lightbox Modal -->
      <div class="lightbox" id="lightbox">
        <button class="lightbox-close" id="lightbox-close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <div class="lightbox-content">
          <img id="lightbox-img" alt="Photo Full View">
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
    // Back Button
    document.getElementById('back-btn')?.addEventListener('click', () => {
      router.back();
    });

    // Play Buttons Handler (Hero + Left Primary)
    const triggerWatch = () => {
      router.navigate('watch', { id: this.mediaId, mediaType: this.mediaType });
    };

    document.getElementById('hero-play-btn')?.addEventListener('click', triggerWatch);
    document.getElementById('left-play-btn')?.addEventListener('click', triggerWatch);

    // Trailer Click Handlers
    const openTrailer = (url) => {
      if (url) window.open(url, '_blank');
    };

    document.getElementById('btn-left-trailer')?.addEventListener('click', (e) => {
      openTrailer(e.currentTarget.dataset.url);
    });

    document.getElementById('right-trailer-box')?.addEventListener('click', (e) => {
      openTrailer(e.currentTarget.dataset.url);
    });

    // Action Buttons Toast
    document.getElementById('btn-watchlist-pill')?.addEventListener('click', () => api.showUnderDevelopmentToast());
    document.getElementById('btn-share-pill')?.addEventListener('click', () => api.showUnderDevelopmentToast());
    document.getElementById('btn-add-list')?.addEventListener('click', () => api.showUnderDevelopmentToast());
    document.getElementById('btn-left-report')?.addEventListener('click', () => router.navigate('report'));

    // Similar Content Container
    const similarContainer = document.getElementById('similar-movies');
    if (similarContainer) {
      if (similar.results?.length > 0) {
        const similarWithType = similar.results.slice(0, 10).map(item => ({
          ...item,
          mediaType: isTV ? 'tv' : 'movie'
        }));
        similarContainer.appendChild(MovieCard.createMultiple(similarWithType));
      } else {
        try {
          const trending = await api.movies.getTrending();
          if (trending.results?.length > 0) {
            const shuffled = trending.results.sort(() => Math.random() - 0.5);
            const randomSelection = shuffled.slice(0, 10).map(item => ({
              ...item,
              mediaType: item.mediaType || 'movie'
            }));
            similarContainer.appendChild(MovieCard.createMultiple(randomSelection));
          }
        } catch (error) {
          console.error('Failed to fetch fallback trending:', error);
        }
      }
    }

    // Cast Cards Clicks
    document.querySelectorAll('.cast-avatar-item.clickable').forEach(card => {
      card.addEventListener('click', () => {
        const personId = card.dataset.personId;
        if (personId) {
          router.navigate('person', { id: parseInt(personId, 10) });
        }
      });
    });

    // Lightbox Setup
    this.setupLightbox(backdrops);
  },

  setupLightbox(backdrops) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');
    let currentIndex = 0;

    if (!lightbox || !lightboxImg) return;

    const photoCards = document.querySelectorAll('.gallery-photo-thumb');
    photoCards.forEach(card => {
      card.addEventListener('click', () => {
        currentIndex = parseInt(card.dataset.index, 10);
        lightboxImg.src = card.dataset.src;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    });

    const closeLightbox = () => {
      lightbox.classList.remove('active');
      lightboxImg.src = '';
      document.body.style.overflow = '';
    };

    lightboxClose?.addEventListener('click', closeLightbox);
    lightbox?.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });

    lightboxPrev?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!backdrops.length) return;
      currentIndex = (currentIndex - 1 + backdrops.length) % backdrops.length;
      lightboxImg.src = backdrops[currentIndex].path;
    });

    lightboxNext?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!backdrops.length) return;
      currentIndex = (currentIndex + 1) % backdrops.length;
      lightboxImg.src = backdrops[currentIndex].path;
    });

    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft' && backdrops.length) {
        currentIndex = (currentIndex - 1 + backdrops.length) % backdrops.length;
        lightboxImg.src = backdrops[currentIndex].path;
      }
      if (e.key === 'ArrowRight' && backdrops.length) {
        currentIndex = (currentIndex + 1) % backdrops.length;
        lightboxImg.src = backdrops[currentIndex].path;
      }
    });
  }
};

window.DetailsPage = DetailsPage;
