/**
 * Person / Actor Details Page
 * Cinematic hero + clean sections matching CineStream home/details language
 */

const PersonPage = {
    personId: null,
    _bioExpanded: false,

    async render(params) {
        const { id } = typeof params === 'object' ? params : { id: params };
        this.personId = id;
        this._bioExpanded = false;

        const container = document.getElementById('main-content');
        container.innerHTML = window.AppLoader
            ? AppLoader.inlineMarkup()
            : `<div class="loading-screen"><div class="loading-spinner"></div></div>`;

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
        const profileImages = images.profiles?.slice(0, 12) || [];
        const age = person.birthday ? this.calculateAge(person.birthday, person.deathday) : null;
        const castMovies = (credits.cast || []).filter((c) => c.poster || c.backdrop);
        const topCast = castMovies.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
        const topBackdrop = topCast.find((c) => c.backdrop)?.backdrop || person.profileImage || '';
        const creditCount = credits.cast?.length || 0;
        const bio = (person.biography || '').trim();
        const bioLong = bio.length > 420;

        const metaChips = [];
        if (person.knownFor) {
            metaChips.push({ label: 'Department', value: person.knownFor });
        }
        if (creditCount) {
            metaChips.push({ label: 'Credits', value: String(creditCount) });
        }
        if (person.birthday) {
            metaChips.push({
                label: person.deathday ? 'Born' : 'Age',
                value: person.deathday
                    ? this.formatDate(person.birthday)
                    : (age != null ? `${age}` : this.formatDate(person.birthday))
            });
        }
        if (person.birthplace) {
            metaChips.push({ label: 'From', value: person.birthplace });
        }
        if (person.deathday) {
            metaChips.push({ label: 'Died', value: this.formatDate(person.deathday) });
        }

        container.innerHTML = `
            <div class="person-page fade-in">
                <button class="back-button" id="back-btn" title="Go Back" aria-label="Go back">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 12H5"/>
                        <polyline points="12 19 5 12 12 5"/>
                    </svg>
                </button>

                <section class="person-hero">
                    ${topBackdrop ? `<img class="person-backdrop" src="${topBackdrop}" alt="" aria-hidden="true">` : ''}
                    <div class="person-hero-overlay"></div>

                    <div class="person-hero-inner">
                        <div class="person-portrait">
                            ${person.profileImage
                ? `<img src="${person.profileImage}" alt="${this._escape(person.name)}" class="person-portrait-img">`
                : `<div class="person-portrait-fallback">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                        <circle cx="12" cy="7" r="4"/>
                                    </svg>
                                </div>`}
                        </div>

                        <div class="person-hero-copy">
                            <p class="person-eyebrow">${this._escape(person.knownFor || 'Talent')}</p>
                            <h1 class="person-name">${this._escape(person.name)}</h1>

                            <div class="person-badges">
                                <span class="person-badge person-badge--green">${this._escape(person.knownFor || 'Acting')}</span>
                                ${person.popularity != null ? `
                                    <span class="person-badge person-badge--pop">
                                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                        </svg>
                                        ${Number(person.popularity).toFixed(1)} Popularity
                                    </span>
                                ` : ''}
                                ${creditCount ? `<span class="person-badge person-badge--ghost">${creditCount} Titles</span>` : ''}
                            </div>

                            ${metaChips.length ? `
                                <div class="person-meta-strip">
                                    ${metaChips.map((chip) => `
                                        <div class="person-meta-chip">
                                            <span class="person-meta-label">${this._escape(chip.label)}</span>
                                            <span class="person-meta-value">${this._escape(chip.value)}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </section>

                <div class="person-body">
                    ${bio ? `
                        <section class="person-section">
                            <div class="person-section-head">
                                <h2 class="person-section-title">Biography</h2>
                            </div>
                            <div class="person-bio ${bioLong ? 'is-collapsed' : ''}" id="person-bio">
                                <p class="person-bio-text">${this._escape(bio)}</p>
                            </div>
                            ${bioLong ? `
                                <button type="button" class="person-bio-toggle" id="bio-toggle">Read more</button>
                            ` : ''}
                        </section>
                    ` : `
                        <section class="person-section">
                            <div class="person-section-head">
                                <h2 class="person-section-title">Biography</h2>
                            </div>
                            <p class="person-bio-empty">No biography available for this person.</p>
                        </section>
                    `}

                    ${profileImages.length > 0 ? `
                        <section class="person-section">
                            <div class="person-section-head">
                                <h2 class="person-section-title">Photos</h2>
                                <span class="person-section-count">${profileImages.length}</span>
                            </div>
                            <div class="person-photos-rail" id="person-photos-rail">
                                ${profileImages.map((img, index) => `
                                    <button type="button" class="person-photo" data-index="${index}" data-src="${img.pathLarge || img.path}" aria-label="Open photo ${index + 1}">
                                        <img src="${img.path}" alt="" loading="lazy">
                                    </button>
                                `).join('')}
                            </div>
                        </section>
                    ` : ''}

                    ${topCast.length > 0 ? `
                        <section class="person-section person-section--filmography">
                            <div class="person-section-head">
                                <h2 class="person-section-title">Known For</h2>
                                <span class="person-section-count">${Math.min(topCast.length, 15)}</span>
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
                        </section>
                    ` : ''}
                </div>
            </div>

            <div class="lightbox" id="lightbox">
                <button class="lightbox-close" id="lightbox-close" aria-label="Close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
                <div class="lightbox-content">
                    <img id="lightbox-img" alt="Photo">
                </div>
                <button class="lightbox-nav lightbox-prev" id="lightbox-prev" aria-label="Previous photo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                </button>
                <button class="lightbox-nav lightbox-next" id="lightbox-next" aria-label="Next photo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </button>
            </div>
        `;

        this.attachEventListeners(profileImages, topCast, bioLong);
    },

    attachEventListeners(profileImages, topCast, bioLong) {
        document.getElementById('back-btn')?.addEventListener('click', () => router.back());

        if (bioLong) {
            const bio = document.getElementById('person-bio');
            const toggle = document.getElementById('bio-toggle');
            toggle?.addEventListener('click', () => {
                this._bioExpanded = !this._bioExpanded;
                bio?.classList.toggle('is-collapsed', !this._bioExpanded);
                toggle.textContent = this._bioExpanded ? 'Show less' : 'Read more';
            });
        }

        const filmographyRow = document.getElementById('filmography-row');
        if (filmographyRow && topCast.length > 0) {
            const topMovies = topCast.slice(0, 15).map((item) => ({
                ...item,
                mediaType: item.mediaType || (item.firstAirDate ? 'tv' : 'movie')
            }));
            filmographyRow.appendChild(MovieCard.createMultiple(topMovies));

            document.getElementById('filmography-prev')?.addEventListener('click', () => {
                filmographyRow.scrollBy({ left: -600, behavior: 'smooth' });
            });
            document.getElementById('filmography-next')?.addEventListener('click', () => {
                filmographyRow.scrollBy({ left: 600, behavior: 'smooth' });
            });
        }

        this.setupLightbox(profileImages);
    },

    setupLightbox(images) {
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = document.getElementById('lightbox-img');
        if (!lightbox || !lightboxImg) return;

        let currentIndex = 0;

        const openAt = (index) => {
            if (!images.length) return;
            currentIndex = index;
            lightboxImg.src = images[currentIndex].pathLarge || images[currentIndex].path;
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
        };

        const closeLightbox = () => {
            lightbox.classList.remove('active');
            lightboxImg.src = '';
            document.body.style.overflow = '';
        };

        document.querySelectorAll('.person-photo').forEach((card) => {
            card.addEventListener('click', () => openAt(parseInt(card.dataset.index, 10)));
        });

        document.getElementById('lightbox-close')?.addEventListener('click', closeLightbox);
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) closeLightbox();
        });

        document.getElementById('lightbox-prev')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!images.length) return;
            openAt((currentIndex - 1 + images.length) % images.length);
        });

        document.getElementById('lightbox-next')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!images.length) return;
            openAt((currentIndex + 1) % images.length);
        });

        document.addEventListener('keydown', (e) => {
            if (!lightbox.classList.contains('active')) return;
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft' && images.length) {
                openAt((currentIndex - 1 + images.length) % images.length);
            }
            if (e.key === 'ArrowRight' && images.length) {
                openAt((currentIndex + 1) % images.length);
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
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    _escape(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
};

window.PersonPage = PersonPage;
