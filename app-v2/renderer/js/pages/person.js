/**
 * Person / Actor Details Page
 * Premium 2-Column Glassmorphic Layout matching Movie Details Aesthetic
 */

const PersonPage = {
  personId: null,

  async render(params) {
    const { id } = typeof params === 'object' ? params : { id: params };
    this.personId = id;

    const container = document.getElementById('main-content');

    // Show loading spinner
    container.innerHTML = `
      <div class="loading-screen">
        <div class="loading-spinner"></div>
        <p>Loading actor profile...</p>
      </div>
    `;

    try {
      const [person, credits, images] = await Promise.all([
        api.person.getDetails(id),
        api.person.getCredits(id),
        api.person.getImages(id)
      ]);

      this.renderContent(container, person, credits, images);
    } catch (error) {
      console.error('Failed to load person details:', error);
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>Failed to load actor profile. Please try again.</p>
          <button class="btn btn-outline" onclick="router.navigate('home')">Go Home</button>
        </div>
      `;
    }
  },

  renderContent(container, person, credits, images) {
    const profileImages = images.profiles?.slice(0, 10) || [];
    const age = person.birthday ? this.calculateAge(person.birthday, person.deathday) : null;
    
    // Sort movies/TV show credits by popularity or vote count
    const castMovies = (credits.cast || []).filter(c => c.poster || c.backdrop);
    const topCast = castMovies.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));

    // Choose top backdrop from their top movie for hero ambient background
    const topBackdrop = topCast.find(c => c.backdrop)?.backdrop || person.profileImage || '';

    container.innerHTML = `
      <div class="person-page fade-in">
        <!-- Floating Back Button (Positioned safely below topnav) -->
        <button class="back-button" id="back-btn" title="Go Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>

        <!-- 1. Ambient Hero Header -->
        <div class="person-hero">
          ${topBackdrop ? `<img class="person-backdrop" src="${topBackdrop}" alt="${person.name}">` : ''}
          <div class="person-hero-overlay"></div>
        </div>

        <!-- 2. Main 2-Column Content Grid -->
        <div class="person-content-grid">
          
          <!-- Column 1: Sidebar Profile Card -->
          <div class="person-col-sidebar">
            <div class="person-poster-wrap">
              ${person.profileImage ? `
                <img src="${person.profileImage}" alt="${person.name}" class="person-poster-img">
              ` : `
                <div class="person-poster-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
              `}
            </div>

            <!-- Personal Info Card -->
            <div class="person-info-card">
              <h3 class="info-card-title">Personal Info</h3>
              
              <div class="info-kv-stack">
                <div class="info-kv-item">
                  <span class="info-kv-label">Known For</span>
                  <span class="info-kv-value">${person.knownFor || 'Acting'}</span>
                </div>

                <div class="info-kv-item">
                  <span class="info-kv-label">Known Credits</span>
                  <span class="info-kv-value">${credits.cast?.length || 0} Credits</span>
                </div>

                ${person.birthday ? `
                  <div class="info-kv-item">
                    <span class="info-kv-label">Born</span>
                    <span class="info-kv-value">${this.formatDate(person.birthday)}${age ? ` (${age} years old)` : ''}</span>
                  </div>
                ` : ''}

                ${person.deathday ? `
                  <div class="info-kv-item">
                    <span class="info-kv-label">Died</span>
                    <span class="info-kv-value">${this.formatDate(person.deathday)}</span>
                  </div>
                ` : ''}

                ${person.birthplace ? `
                  <div class="info-kv-item">
                    <span class="info-kv-label">Place of Birth</span>
                    <span class="info-kv-value">${person.birthplace}</span>
                  </div>
                ` : ''}

                ${person.gender ? `
                  <div class="info-kv-item">
                    <span class="info-kv-label">Gender</span>
                    <span class="info-kv-value">${person.gender === 2 ? 'Male' : person.gender === 1 ? 'Female' : 'Non-binary'}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- Column 2: Main Details & Filmography -->
          <div class="person-col-main">
            <!-- Header Title -->
            <div class="person-main-header">
              <h1 class="person-main-title">${person.name}</h1>
              <div class="person-header-badges">
                <span class="person-dept-badge">${person.knownFor || 'Acting'}</span>
                ${person.popularity ? `
                  <span class="person-pop-badge">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    ${person.popularity.toFixed(1)} Popularity
                  </span>
                ` : ''}
              </div>
            </div>

            <!-- Biography Card -->
            ${person.biography ? `
              <div class="person-section-card">
                <h3 class="section-subheading">Biography</h3>
                <div class="biography-content">
                  <p class="biography-text">${person.biography}</p>
                </div>
              </div>
            ` : ''}

            <!-- Photos Gallery Section -->
            ${profileImages.length > 0 ? `
              <div class="person-section-card">
                <h3 class="section-subheading">Photos</h3>
                <div class="person-photos-grid">
                  ${profileImages.map((img, index) => `
                    <div class="person-photo-thumb" data-index="${index}" data-src="${img.pathLarge || img.path}">
                      <img src="${img.path}" alt="Photo ${index + 1}" loading="lazy">
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Known For / Filmography Carousel -->
            ${topCast.length > 0 ? `
              <div class="person-section-card">
                <div class="section-header">
                  <h3 class="section-subheading">Known For</h3>
                </div>
                <div class="movies-carousel">
                  <button class="carousel-nav prev" id="filmography-prev" aria-label="Previous">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                  <div class="movies-row" id="filmography-row"></div>
                  <button class="carousel-nav next" id="filmography-next" aria-label="Next">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </div>
              </div>
            ` : ''}
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
          <img id="lightbox-img" alt="Actor Photo">
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

    this.attachEventListeners(profileImages, topCast);
  },

  attachEventListeners(profileImages, topCast) {
    // Back button
    document.getElementById('back-btn')?.addEventListener('click', () => {
      router.back();
    });

    // Known For Filmography Row
    const filmographyRow = document.getElementById('filmography-row');
    if (filmographyRow && topCast.length > 0) {
      const topMovies = topCast.slice(0, 15).map(item => ({
        ...item,
        mediaType: item.mediaType || (item.firstAirDate ? 'tv' : 'movie')
      }));
      filmographyRow.appendChild(MovieCard.createMultiple(topMovies));

      const prevBtn = document.getElementById('filmography-prev');
      const nextBtn = document.getElementById('filmography-next');
      if (prevBtn) prevBtn.addEventListener('click', () => filmographyRow.scrollBy({ left: -600, behavior: 'smooth' }));
      if (nextBtn) nextBtn.addEventListener('click', () => filmographyRow.scrollBy({ left: 600, behavior: 'smooth' }));
    }

    // Lightbox Setup
    this.setupLightbox(profileImages);
  },

  setupLightbox(images) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');
    let currentIndex = 0;

    if (!lightbox || !lightboxImg) return;

    const photoCards = document.querySelectorAll('.person-photo-thumb');
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
      if (!images.length) return;
      currentIndex = (currentIndex - 1 + images.length) % images.length;
      lightboxImg.src = images[currentIndex].pathLarge || images[currentIndex].path;
    });

    lightboxNext?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!images.length) return;
      currentIndex = (currentIndex + 1) % images.length;
      lightboxImg.src = images[currentIndex].pathLarge || images[currentIndex].path;
    });

    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft' && images.length) {
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        lightboxImg.src = images[currentIndex].pathLarge || images[currentIndex].path;
      }
      if (e.key === 'ArrowRight' && images.length) {
        currentIndex = (currentIndex + 1) % images.length;
        lightboxImg.src = images[currentIndex].pathLarge || images[currentIndex].path;
      }
    });
  },

  calculateAge(birthday, deathday) {
    const endDate = deathday ? new Date(deathday) : new Date();
    const birthDate = new Date(birthday);
    let age = endDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = endDate.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  },

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
};

window.PersonPage = PersonPage;
