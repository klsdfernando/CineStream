/**
 * In-Memory Cache Service
 * Caches TMDB API responses to reduce API calls and improve performance
 */

const NodeCache = require('node-cache');

// Create cache instance with default TTL of 5 minutes
const cache = new NodeCache({
    stdTTL: 300,
    checkperiod: 60,
    useClones: false // Better performance
});

// Cache TTL settings (in seconds)
const CACHE_TTL = {
    trending: 300,      // 5 minutes
    popular: 600,       // 10 minutes
    topRated: 600,      // 10 minutes
    movieDetails: 3600, // 1 hour
    search: 300,        // 5 minutes
};

/**
 * Get cached data or fetch from source
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch data if not cached
 * @param {number} ttl - Time to live in seconds
 */
async function getCachedOrFetch(key, fetchFn, ttl = 300) {
    const cached = cache.get(key);
    if (cached !== undefined) {
        return cached;
    }

    const data = await fetchFn();
    cache.set(key, data, ttl);
    return data;
}

/**
 * Clear specific cache key
 * @param {string} key - Cache key to clear
 */
function clearCache(key) {
    cache.del(key);
}

/**
 * Clear all cache
 */
function clearAllCache() {
    cache.flushAll();
}

module.exports = { cache, getCachedOrFetch, clearCache, clearAllCache, CACHE_TTL };
