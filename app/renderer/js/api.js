/**
 * API Service - Handles all communication with backend server
 */

const API_BASE_URL = 'https://movie-app.sushanfer.dev';

const api = {
    /**
     * Helper to fetch with automatic retries on failure
     */
    async fetchWithRetry(url, options = {}, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `API Error: ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                // If it's the last attempt, strictly throw the error
                if (i === retries - 1) throw error;
                
                console.warn(`[Retry ${i + 1}/${retries}] Request failed for ${url}. Retrying...`, error.message);
                // Wait before retrying (exponential backoff: 500ms, then 1000ms)
                await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
            }
        }
    },

    /**
     * Make a GET request to the API
     */
    async get(endpoint, params = {}) {
        const url = new URL(`${API_BASE_URL}${endpoint}`);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.append(key, value);
            }
        });

        try {
            return await this.fetchWithRetry(url.toString(), {});
        } catch (error) {
            console.error('API Request Failed:', error);
            throw error;
        }
    },

    /**
     * Make an authenticated API request
     */
    async authenticatedRequest(endpoint, method = 'GET', body = null) {
        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new Error('Not authenticated');
        }

        const url = `${API_BASE_URL}${endpoint}`;
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            return await this.fetchWithRetry(url, options);
        } catch (error) {
            console.error('Authenticated API Request Failed:', error);
            throw error;
        }
    },

    // Movie endpoints
    movies: {
        getTrending: (timeWindow = 'day') => api.get('/api/movies/trending', { timeWindow }),
        getPopular: (page = 1) => api.get('/api/movies/popular', { page }),
        getTopRated: (page = 1) => api.get('/api/movies/top-rated', { page }),
        getNowPlaying: (page = 1) => api.get('/api/movies/now-playing', { page }),
        getUpcoming: (page = 1) => api.get('/api/movies/upcoming', { page }),
        getRandom: () => api.get('/api/movies/random'),
        getDetails: (id) => api.get(`/api/movies/${id}`),
        getCredits: (id) => api.get(`/api/movies/${id}/credits`),
        getImages: (id) => api.get(`/api/movies/${id}/images`),
        getVideos: (id) => api.get(`/api/movies/${id}/videos`),
        getSimilar: (id, page = 1) => api.get(`/api/movies/${id}/similar`, { page }),
        getRecommendations: (id, page = 1) => api.get(`/api/movies/${id}/recommendations`, { page }),
    },

    // TV Series endpoints
    tv: {
        getTrending: () => api.get('/api/tv/trending'),
        getPopular: (page = 1) => api.get('/api/tv/popular', { page }),
        getTopRated: (page = 1) => api.get('/api/tv/top-rated', { page }),
        getAiring: () => api.get('/api/tv/airing'),
        getDetails: (id) => api.get(`/api/tv/${id}`),
        getSeason: (id, seasonNumber) => api.get(`/api/tv/${id}/season/${seasonNumber}`),
        getCredits: (id) => api.get(`/api/tv/${id}/credits`),
        getSimilar: (id, page = 1) => api.get(`/api/tv/${id}/similar`, { page }),
    },

    // Search endpoint
    search: (query, page = 1) => api.get('/api/search', { query, page }),

    // Discover endpoint
    discover: (options = {}) => api.get('/api/discover', options),

    // Genres endpoint
    getGenres: () => api.get('/api/genres'),

    // Person/Actor endpoints
    person: {
        getDetails: (id) => api.get(`/api/person/${id}`),
        getCredits: (id) => api.get(`/api/person/${id}/credits`),
        getMovies: (id) => api.get(`/api/person/${id}/movies`),
        getTV: (id) => api.get(`/api/person/${id}/tv`),
        getImages: (id) => api.get(`/api/person/${id}/images`),
    },

    // Anime endpoints
    anime: {
        getTrending: () => api.get('/api/anime/trending'),
        getPopular: (page = 1) => api.get('/api/anime/popular', { page }),
        getTopRated: (page = 1) => api.get('/api/anime/top-rated', { page }),
        getAiring: () => api.get('/api/anime/airing'),
        discover: (options = {}) => api.get('/api/anime/discover', options),
        getGenres: () => api.get('/api/anime/genres'),
    },

    // User Activity endpoints (Mocked for graceful degradation)
    activity: {
        record: async (data) => {
            // Only show toast for manual user actions like Likes/Dislikes, not background watch recording
            if (data.actionType !== 'watched') {
                api.showUnderDevelopmentToast();
            }
            return { success: true, result: { action: 'ignored', type: data.actionType } };
        },
        getHistory: async (type) => {
            return { history: [] };
        },
        getStatus: async (mediaId) => {
            return { status: 'none' };
        },
    },

    // Playlists endpoints (Mocked for graceful degradation)
    playlists: {
        create: async (data) => {
            api.showUnderDevelopmentToast();
            return { success: false, error: 'Playlists are under development' };
        },
        getAll: async () => {
            return { playlists: [] };
        },
        getDetails: async (id) => {
            return { playlist: null };
        },
        addItem: async (id, data) => {
            api.showUnderDevelopmentToast();
            return { success: false, error: 'Playlists are under development' };
        },
        removeItem: async (id, mediaId) => {
            return { success: true };
        },
        delete: async (id) => {
            return { success: true };
        },
    },

    showUnderDevelopmentToast: () => {
        // Remove existing toast if any
        const existing = document.getElementById('dev-toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.id = 'dev-toast';
        toast.style.cssText = 'position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: rgba(30, 30, 30, 0.95); color: #fff; padding: 12px 24px; border-radius: 8px; border-left: 4px solid var(--accent-green); z-index: 9999; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 12px; font-weight: 500; font-size: 14px; animation: slideUp 0.3s ease forwards; pointer-events: none;';
        
        toast.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--accent-green)" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            This feature is currently under development!
        `;
        
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                @keyframes slideUp { from { bottom: -50px; opacity: 0; } to { bottom: 30px; opacity: 1; } }
                @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// Make api globally available
window.api = api;
