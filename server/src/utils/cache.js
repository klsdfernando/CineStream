import NodeCache from 'node-cache';

// Create cache instance with default TTL of 5 minutes
const cache = new NodeCache({
    stdTTL: 300,
    checkperiod: 60,
    useClones: false // Better performance
});

/**
 * Get cached data or fetch from source
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch data if not cached
 * @param {number} ttl - Time to live in seconds
 */
export async function getCachedOrFetch(key, fetchFn, ttl = 300) {
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
export function clearCache(key) {
    cache.del(key);
}

/**
 * Clear all cache
 */
export function clearAllCache() {
    cache.flushAll();
}

export default cache;
