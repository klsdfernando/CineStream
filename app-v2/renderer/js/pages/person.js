/**
 * Person/Actor Details Page
 */

const PersonPage = {
    personId: null,

    async render(params) {
        const { id } = typeof params === 'object' ? params : { id: params };
        this.personId = id;

        const container = document.getElementById('main-content');

        // Show loading
        container.innerHTML = `
            <div class="loading-screen">
                <div class="loading-spinner"></div>
                <p>Loading profile...</p>
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
                    <p>Failed to load profile. Please try again.</p>
                    <button class="btn btn-outline" onclick="router.navigate('home')">Go Home</button>
                </div>
            `;
        }
    },

    renderContent(container, person, credits, images) {
        const profileImages = images.profiles?.slice(0, 6) || [];
        const age = person.birthday ? this.calculateAge(person.birthday, person.deathday) : null;

        container.innerHTML = `
            <div class="person-page fade-in">
                <!-- Back Button -->
                <button class="back-button" id="back-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 12H5"/>
                        <polyline points="12 19 5 12 12 5"/>
                    </svg>
                </button>

                <!-- Person Header -->
                <div class="person-header">
                    <div class="person-avatar-container">
                        ${person.profileImage ? `
                            <img src="${person.profileImage}" alt="${person.name}" class="person-avatar">
                        ` : `
                            <div class="person-avatar-placeholder">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                    <circle cx="12" cy="7" r="4"/>
                                </svg>
                            </div>
                        `}
                    </div>
                    <div class="person-info">
                        <h1 class="person-name">${person.name}</h1>
                        <span class="person-known-for">${person.knownFor || 'Acting'}</span>
                        
                        <div class="person-meta">
                            ${person.birthday ? `
                                <div class="person-meta-item">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                        <line x1="16" y1="2" x2="16" y2="6"/>
                                        <line x1="8" y1="2" x2="8" y2="6"/>
                                        <line x1="3" y1="10" x2="21" y2="10"/>
                                    </svg>
                                    <span>Born: ${this.formatDate(person.birthday)}${age ? ` (${age} years old)` : ''}</span>
                                </div>
                            ` : ''}
                            ${person.deathday ? `
                                <div class="person-meta-item deceased">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <line x1="12" y1="8" x2="12" y2="12"/>
                                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                                    </svg>
                                    <span>Died: ${this.formatDate(person.deathday)}</span>
                                </div>
                            ` : ''}
                            ${person.birthplace ? `
                                <div class="person-meta-item">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                        <circle cx="12" cy="10" r="3"/>
                                    </svg>
                                    <span>${person.birthplace}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- Biography -->
                ${person.biography ? `
                    <div class="person-section">
                        <h3 class="section-title">Biography</h3>
                        <div class="person-biography">
                            <p class="biography-text">${person.biography}</p>
                        </div>
                    </div>
                ` : ''}

                <!-- Photos -->
                ${profileImages.length > 0 ? `
                    <div class="person-section">
                        <h3 class="section-title">Photos</h3>
                        <div class="photos-grid">
                            ${profileImages.map((img, index) => `
                                <div class="photo-card person-photo" data-index="${index}" data-src="${img.pathLarge || img.path}">
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

                <!-- Known For / Filmography -->
                ${credits.cast?.length > 0 ? `
                    <div class="person-section">
                        <h3 class="section-title">Known For</h3>
                        <div class="filmography-grid">
                            ${credits.cast.slice(0, 20).map(item => `
                                <div class="filmography-card" data-id="${item.id}" data-media-type="${item.mediaType}">
                                    <div class="filmography-poster">
                                        ${item.poster ? `
                                            <img src="${item.poster}" alt="${item.title}" loading="lazy">
                                        ` : `
                                            <div class="poster-placeholder">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                                                    <line x1="7" y1="2" x2="7" y2="22"/>
                                                    <line x1="17" y1="2" x2="17" y2="22"/>
                                                </svg>
                                            </div>
                                        `}
                                        <div class="filmography-overlay">
                                            <span class="media-type-badge ${item.mediaType}">${item.mediaType === 'tv' ? 'TV' : 'Movie'}</span>
                                        </div>
                                    </div>
                                    <div class="filmography-info">
                                        <h4 class="filmography-title">${item.title}</h4>
                                        <span class="filmography-character">${item.character || 'N/A'}</span>
                                        <div class="filmography-meta">
                                            ${item.year ? `<span>${item.year}</span>` : ''}
                                            ${item.rating ? `
                                                <span class="filmography-rating">
                                                    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                                    </svg>
                                                    ${item.rating}
                                                </span>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
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

        this.attachEventListeners(profileImages, credits);
    },

    attachEventListeners(profileImages, credits) {
        // Back button
        document.getElementById('back-btn').addEventListener('click', () => {
            router.back();
        });

        // Filmography cards click
        const filmographyCards = document.querySelectorAll('.filmography-card');
        filmographyCards.forEach(card => {
            card.addEventListener('click', () => {
                const id = parseInt(card.dataset.id);
                const mediaType = card.dataset.mediaType;
                router.navigate('details', { id, mediaType });
            });
        });

        // Photo lightbox
        this.setupLightbox(profileImages);
    },

    setupLightbox(images) {
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = document.getElementById('lightbox-img');
        const lightboxClose = document.getElementById('lightbox-close');
        const lightboxPrev = document.getElementById('lightbox-prev');
        const lightboxNext = document.getElementById('lightbox-next');
        let currentIndex = 0;

        // Open lightbox on photo click
        const photoCards = document.querySelectorAll('.person-photo');
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

        lightboxClose?.addEventListener('click', closeLightbox);
        lightbox?.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });

        // Navigate photos
        lightboxPrev?.addEventListener('click', (e) => {
            e.stopPropagation();
            currentIndex = (currentIndex - 1 + images.length) % images.length;
            lightboxImg.src = images[currentIndex].pathLarge || images[currentIndex].path;
        });

        lightboxNext?.addEventListener('click', (e) => {
            e.stopPropagation();
            currentIndex = (currentIndex + 1) % images.length;
            lightboxImg.src = images[currentIndex].pathLarge || images[currentIndex].path;
        });

        // Keyboard navigation
        const handleKeydown = (e) => {
            if (!lightbox.classList.contains('active')) return;

            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') {
                currentIndex = (currentIndex - 1 + images.length) % images.length;
                lightboxImg.src = images[currentIndex].pathLarge || images[currentIndex].path;
            }
            if (e.key === 'ArrowRight') {
                currentIndex = (currentIndex + 1) % images.length;
                lightboxImg.src = images[currentIndex].pathLarge || images[currentIndex].path;
            }
        };
        document.addEventListener('keydown', handleKeydown);
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
