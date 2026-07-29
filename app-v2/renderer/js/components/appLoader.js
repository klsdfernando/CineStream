/**
 * Centered CineStream brand loading overlay
 */

const AppLoader = {
    _el: null,
    _count: 0,

    init() {
        this._el = document.getElementById('app-loader');
        if (!this._el) {
            this._el = document.createElement('div');
            this._el.id = 'app-loader';
            this._el.className = 'app-loader';
            this._el.innerHTML = this.markup();
            this._el.setAttribute('aria-hidden', 'true');
            this._el.setAttribute('aria-busy', 'false');
            document.querySelector('.app-container')?.appendChild(this._el);
        }
        return this._el;
    },

    markup() {
        return `
            <div class="app-loader-inner">
                <div class="app-loader-brand" aria-label="CineStream">
                    <span class="app-loader-cine">Cine</span><span class="app-loader-stream">Stream</span>
                </div>
                <div class="app-loader-bar" aria-hidden="true">
                    <span class="app-loader-bar-fill"></span>
                </div>
            </div>
        `;
    },

    /** Inline loading block for page sections (same brand look) */
    inlineMarkup(message = '') {
        return `
            <div class="loading-screen loading-screen--brand">
                <div class="app-loader-brand" aria-label="CineStream">
                    <span class="app-loader-cine">Cine</span><span class="app-loader-stream">Stream</span>
                </div>
                <div class="app-loader-bar" aria-hidden="true">
                    <span class="app-loader-bar-fill"></span>
                </div>
                ${message ? `<p class="app-loader-message">${message}</p>` : ''}
            </div>
        `;
    },

    show() {
        this.init();
        this._count += 1;
        this._el.classList.add('is-visible');
        this._el.setAttribute('aria-hidden', 'false');
        this._el.setAttribute('aria-busy', 'true');
        document.body.classList.add('is-app-loading');
    },

    hide() {
        if (!this._el) return;
        this._count = Math.max(0, this._count - 1);
        if (this._count > 0) return;
        this._el.classList.remove('is-visible');
        this._el.setAttribute('aria-hidden', 'true');
        this._el.setAttribute('aria-busy', 'false');
        document.body.classList.remove('is-app-loading');
    },

    async wrap(promise) {
        this.show();
        try {
            return await promise;
        } finally {
            this.hide();
        }
    }
};

window.AppLoader = AppLoader;
