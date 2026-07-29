/**
 * Carousel Component - Horizontal scrolling movie rows
 */

const Carousel = {
    /**
     * Create a carousel section
     * @param {Object} options
     * @param {string} options.title - Section title
     * @param {string} options.iconType - Icon type (fire, star, clapperboard, shuffle)
     * @param {Array} options.movies - Array of movies
     * @returns {HTMLElement}
     */
    create({ title, iconType, movies }) {
        const section = document.createElement('section');
        section.className = 'section';

        const icon = this.getIcon(iconType);

        section.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">
          <span class="section-icon ${iconType}">${icon}</span>
          ${title}
        </h2>
        <button class="see-all-btn">
          See All
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
      <div class="movies-carousel">
        <button class="carousel-nav prev">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="movies-row"></div>
        <button class="carousel-nav next">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    `;

        // Add movies
        const moviesRow = section.querySelector('.movies-row');
        moviesRow.appendChild(MovieCard.createMultiple(movies));

        // Add navigation handlers
        const prevBtn = section.querySelector('.carousel-nav.prev');
        const nextBtn = section.querySelector('.carousel-nav.next');

        prevBtn.addEventListener('click', () => {
            moviesRow.scrollBy({ left: -600, behavior: 'smooth' });
        });

        nextBtn.addEventListener('click', () => {
            moviesRow.scrollBy({ left: 600, behavior: 'smooth' });
        });

        return section;
    },

    /**
     * Get SVG icon for section
     */
    getIcon(type) {
        const icons = {
            fire: `<svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 23c-4.97 0-9-4.03-9-9 0-2.07.7-4.5 2.1-7.18.33-.57 1.04-.7 1.53-.28l3.17 2.64 2.52-3.74c.4-.6 1.27-.58 1.64.02.58.87 1.25 1.88 1.69 2.67.27.48.74.8 1.26.88 1.52.23 2.97 1.09 3.91 2.37C21.54 12.6 22 14.23 22 16c0 3.86-4.48 7-10 7z"/>
      </svg>`,
            star: `<svg viewBox="0 0 24 24" fill="currentColor">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>`,
            clapperboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8H4Z"/>
        <path d="m4 11-.88-2.87a2 2 0 0 1 1.33-2.5l11.48-3.5a2 2 0 0 1 2.5 1.32l.87 2.87L4 11.01Z"/>
        <path d="m6.6 4.99 3.38 4.2"/>
        <path d="m11.86 3.38 3.38 4.2"/>
      </svg>`,
            shuffle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 3h5v5"/>
        <path d="M4 20 21 3"/>
        <path d="M21 16v5h-5"/>
        <path d="M15 15l6 6"/>
        <path d="M4 4l5 5"/>
      </svg>`
        };
        return icons[type] || icons.clapperboard;
    }
};

window.Carousel = Carousel;
