/**
 * Hero Carousel - Featured backdrop slider with overlapping poster rail
 */

const HeroCarousel = {
    _interval: null,
    _hoverTimer: null,
    _index: 0,
    _items: [],
    _root: null,
    _isHoveringRail: false,
    _onResize: null,

    /**
     * @param {Object} options
     * @param {Array} options.items - Movies/TV with backdrop, title, etc.
     * @param {string} [options.railTitle='Featured']
     * @param {string} [options.mediaType='movie']
     * @returns {HTMLElement}
     */
    create({ items, railTitle = 'Featured', mediaType = 'movie' }) {
        this.destroy();

        const featured = (items || [])
            .filter((m) => m && (m.backdrop || m.backdropOriginal || m.poster))
            .slice(0, 12);

        if (featured.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'home-hero home-hero--empty';
            return empty;
        }

        this._items = featured.map((m) => ({
            ...m,
            mediaType: m.mediaType || mediaType
        }));
        this._index = 0;
        this._isHoveringRail = false;

        const root = document.createElement('section');
        root.className = 'home-hero';
        root.innerHTML = `
            <div class="home-hero-stage">
                <div class="home-hero-slides"></div>
                <div class="home-hero-gradient"></div>
                <div class="home-hero-content">
                    <p class="home-hero-eyebrow"></p>
                    <h2 class="home-hero-title"></h2>
                    <div class="home-hero-meta"></div>
                    <p class="home-hero-overview"></p>
                    <div class="home-hero-actions">
                        <button type="button" class="home-hero-play">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                            Play
                        </button>
                        <button type="button" class="home-hero-add" title="View details" aria-label="View details">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="home-hero-dots" role="tablist" aria-label="Featured slides"></div>
            </div>
            <div class="home-hero-rail">
                <h3 class="home-hero-rail-title">${this._escape(railTitle)}</h3>
                <div class="home-hero-rail-track-wrap">
                    <button type="button" class="home-hero-rail-nav prev" aria-label="Previous">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"/>
                        </svg>
                    </button>
                    <div class="home-hero-rail-track"></div>
                    <button type="button" class="home-hero-rail-nav next" aria-label="Next">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        const slidesEl = root.querySelector('.home-hero-slides');
        const dotsEl = root.querySelector('.home-hero-dots');
        const track = root.querySelector('.home-hero-rail-track');
        const rail = root.querySelector('.home-hero-rail');

        this._items.forEach((item, i) => {
            const slide = document.createElement('div');
            slide.className = `home-hero-slide${i === 0 ? ' active' : ''}`;
            slide.dataset.index = String(i);
            const src = item.backdropOriginal || item.backdrop || item.poster;
            slide.innerHTML = `<img src="${src}" alt="" loading="${i === 0 ? 'eager' : 'lazy'}">`;
            slidesEl.appendChild(slide);

            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = `home-hero-dot${i === 0 ? ' active' : ''}`;
            dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
            dot.addEventListener('click', () => this.goTo(i, { commit: true }));
            dotsEl.appendChild(dot);

            const poster = document.createElement('button');
            poster.type = 'button';
            poster.className = `home-hero-poster${i === 0 ? ' active' : ''}`;
            poster.dataset.index = String(i);
            poster.setAttribute('aria-label', item.title || `Slide ${i + 1}`);
            poster.innerHTML = item.poster
                ? `<img src="${item.poster}" alt="${this._escape(item.title || '')}" loading="lazy">`
                : `<span class="home-hero-poster-fallback">${this._escape((item.title || '?').charAt(0))}</span>`;
            poster.addEventListener('mouseenter', () => this.preview(i));
            poster.addEventListener('focus', () => this.preview(i));
            poster.addEventListener('click', () => this.goTo(i, { commit: true }));
            track.appendChild(poster);
        });

        root.querySelector('.home-hero-play').addEventListener('click', () => {
            const item = this._items[this._index];
            if (!item) return;
            router.navigate('watch', { id: item.id, mediaType: item.mediaType || 'movie' });
        });

        root.querySelector('.home-hero-add').addEventListener('click', () => {
            const item = this._items[this._index];
            if (!item) return;
            router.navigate('details', { id: item.id, mediaType: item.mediaType || 'movie' });
        });

        root.querySelector('.home-hero-rail-nav.prev').addEventListener('click', () => {
            track.scrollBy({ left: -520, behavior: 'smooth' });
        });
        root.querySelector('.home-hero-rail-nav.next').addEventListener('click', () => {
            track.scrollBy({ left: 520, behavior: 'smooth' });
        });

        rail.addEventListener('mouseenter', () => {
            this._isHoveringRail = true;
            this.pause();
        });
        rail.addEventListener('mouseleave', () => {
            this._isHoveringRail = false;
            this._clearHoverTimer();
            this.resume();
        });

        this._root = root;
        this._onResize = () => this._fitTitle();
        window.addEventListener('resize', this._onResize);
        this._renderContent({ animate: false });
        this.resume();
        return root;
    },

    /**
     * Hover preview — updates fullscreen hero smoothly without committing autoplay index permanently beyond preview
     */
    preview(index) {
        if (!this._root || !this._items.length) return;
        this._clearHoverTimer();
        this._hoverTimer = setTimeout(() => {
            this.goTo(index, { commit: false, scrollPoster: false });
        }, 80);
    },

    goTo(index, { commit = true, scrollPoster = true } = {}) {
        if (!this._root || !this._items.length) return;
        const len = this._items.length;
        const next = ((index % len) + len) % len;
        if (next === this._index) {
            this._syncUi({ scrollPoster });
            return;
        }

        this._index = next;
        this._renderContent({ animate: true });
        this._syncUi({ scrollPoster });

        if (commit && !this._isHoveringRail) {
            this.resume();
        } else {
            this.pause();
        }
    },

    next() {
        this.goTo(this._index + 1, { commit: true });
    },

    pause() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    },

    resume() {
        this.pause();
        if (this._items.length < 2 || this._isHoveringRail) return;
        this._interval = setInterval(() => this.next(), 6500);
    },

    destroy() {
        this.pause();
        this._clearHoverTimer();
        if (this._onResize) {
            window.removeEventListener('resize', this._onResize);
            this._onResize = null;
        }
        this._items = [];
        this._root = null;
        this._index = 0;
        this._isHoveringRail = false;
    },

    _clearHoverTimer() {
        if (this._hoverTimer) {
            clearTimeout(this._hoverTimer);
            this._hoverTimer = null;
        }
    },

    _syncUi({ scrollPoster = true } = {}) {
        if (!this._root) return;
        this._root.querySelectorAll('.home-hero-slide').forEach((el, i) => {
            el.classList.toggle('active', i === this._index);
        });
        this._root.querySelectorAll('.home-hero-dot').forEach((el, i) => {
            el.classList.toggle('active', i === this._index);
        });

        const track = this._root.querySelector('.home-hero-rail-track');
        this._root.querySelectorAll('.home-hero-poster').forEach((el, i) => {
            const isActive = i === this._index;
            el.classList.toggle('active', isActive);
            if (scrollPoster && isActive && track) {
                const targetLeft = el.offsetLeft - (track.clientWidth / 2) + (el.offsetWidth / 2);
                track.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
            }
        });
    },

    _renderContent({ animate = true } = {}) {
        if (!this._root) return;
        const item = this._items[this._index];
        if (!item) return;

        const content = this._root.querySelector('.home-hero-content');
        const match = this._matchPercent(item.rating);
        const year = item.year || (item.releaseDate ? String(item.releaseDate).slice(0, 4) : '');
        const typeLabel = item.mediaType === 'tv' ? 'TV Series' : 'Featured Film';

        const apply = () => {
            this._root.querySelector('.home-hero-eyebrow').textContent = typeLabel;
            this._root.querySelector('.home-hero-title').textContent = item.title || 'Untitled';
            this._root.querySelector('.home-hero-meta').innerHTML = `
                ${match != null ? `<span class="home-hero-match">${match}% Match</span>` : ''}
                ${year ? `<span class="home-hero-year">${this._escape(year)}</span>` : ''}
                ${item.rating ? `<span class="home-hero-rating">★ ${this._escape(String(item.rating))}</span>` : ''}
            `;
            this._root.querySelector('.home-hero-overview').textContent = this._truncate(item.overview || '', 160);
            this._fitTitle();
        };

        if (!animate) {
            apply();
            content.classList.add('is-ready');
            return;
        }

        content.classList.remove('is-ready');
        content.classList.add('is-switching');

        window.setTimeout(() => {
            apply();
            content.classList.remove('is-switching');
            content.classList.add('is-ready');
        }, 180);
    },

    /**
     * Shrink hero title font until it fits within 2 lines.
     */
    _fitTitle() {
        if (!this._root) return;
        const title = this._root.querySelector('.home-hero-title');
        if (!title || !title.textContent) return;

        const styles = window.getComputedStyle(title);
        const lineHeightRatio = parseFloat(styles.lineHeight) / parseFloat(styles.fontSize) || 1.05;
        const maxPx = Math.min(64, Math.max(28, Math.round(window.innerWidth * 0.055)));
        const minPx = 22;

        // Measure without clamp so scrollHeight reflects true wrapped height
        title.style.display = 'block';
        title.style.webkitLineClamp = 'unset';
        title.style.overflow = 'visible';
        title.style.fontSize = `${maxPx}px`;

        let size = maxPx;
        const maxHeight = () => size * lineHeightRatio * 2 + 1;

        while (size > minPx && title.scrollHeight > maxHeight()) {
            size -= 1;
            title.style.fontSize = `${size}px`;
        }

        // Restore 2-line clamp for very long titles that still overflow at min size
        title.style.display = '-webkit-box';
        title.style.webkitBoxOrient = 'vertical';
        title.style.webkitLineClamp = '2';
        title.style.overflow = 'hidden';
    },

    _matchPercent(rating) {
        const n = Number(rating);
        if (!n || Number.isNaN(n)) return null;
        return Math.min(99, Math.round((n / 10) * 100));
    },

    _truncate(text, max) {
        if (!text || text.length <= max) return text || '';
        return text.slice(0, max).replace(/\s+\S*$/, '') + '…';
    },

    _escape(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
};

window.HeroCarousel = HeroCarousel;
