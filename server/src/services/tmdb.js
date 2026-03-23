import { config } from '../config.js';
import https from 'https';

const { apiKey, baseUrl, imageBaseUrl } = config.tmdb;

/**
 * Make a request to TMDB API using https module (more reliable than fetch)
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 */
async function tmdbFetch(endpoint, params = {}) {
    const url = new URL(`${baseUrl}${endpoint}`);
    url.searchParams.append('api_key', apiKey);

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, value);
        }
    });

    return new Promise((resolve, reject) => {
        https.get(url.toString(), (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        reject(new Error(`TMDB API Error: ${res.statusCode}`));
                        return;
                    }
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse TMDB response: ${e.message}`));
                }
            });
        }).on('error', (e) => {
            reject(new Error(`TMDB request failed: ${e.message}`));
        });
    });
}

/**
 * Get full image URL from TMDB path
 * @param {string} path - Image path from TMDB
 * @param {string} size - Image size (w200, w300, w500, w780, original)
 */
export function getImageUrl(path, size = 'w500') {
    if (!path) return null;
    return `${imageBaseUrl}/${size}${path}`;
}

/**
 * Transform movie data to our format
 */
function transformMovie(movie) {
    return {
        id: movie.id,
        title: movie.title,
        overview: movie.overview,
        releaseDate: movie.release_date,
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
        rating: movie.vote_average ? parseFloat(movie.vote_average.toFixed(1)) : null,
        voteCount: movie.vote_count,
        popularity: movie.popularity,
        poster: getImageUrl(movie.poster_path, 'w500'),
        posterSmall: getImageUrl(movie.poster_path, 'w300'),
        backdrop: getImageUrl(movie.backdrop_path, 'w1280'),
        backdropOriginal: getImageUrl(movie.backdrop_path, 'original'),
        genreIds: movie.genre_ids || [],
        originalLanguage: movie.original_language,
        adult: movie.adult,
    };
}

/**
 * Transform detailed movie data
 */
function transformMovieDetails(movie) {
    return {
        id: movie.id,
        title: movie.title,
        tagline: movie.tagline,
        overview: movie.overview,
        releaseDate: movie.release_date,
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
        runtime: movie.runtime,
        runtimeFormatted: movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : null,
        rating: movie.vote_average ? parseFloat(movie.vote_average.toFixed(1)) : null,
        voteCount: movie.vote_count,
        popularity: movie.popularity,
        budget: movie.budget,
        revenue: movie.revenue,
        poster: getImageUrl(movie.poster_path, 'w500'),
        posterLarge: getImageUrl(movie.poster_path, 'w780'),
        backdrop: getImageUrl(movie.backdrop_path, 'w1280'),
        backdropOriginal: getImageUrl(movie.backdrop_path, 'original'),
        genres: movie.genres || [],
        productionCompanies: movie.production_companies?.map(c => ({
            id: c.id,
            name: c.name,
            logo: getImageUrl(c.logo_path, 'w200'),
        })) || [],
        productionCountries: movie.production_countries || [],
        spokenLanguages: movie.spoken_languages || [],
        status: movie.status,
        homepage: movie.homepage,
        imdbId: movie.imdb_id,
        adult: movie.adult,
    };
}

/**
 * Transform cast member data
 */
function transformCastMember(member) {
    return {
        id: member.id,
        name: member.name,
        character: member.character,
        profileImage: getImageUrl(member.profile_path, 'w185'),
        order: member.order,
    };
}

/**
 * Transform TV series data (list item)
 */
function transformTVSeries(show) {
    return {
        id: show.id,
        title: show.name,
        overview: show.overview,
        releaseDate: show.first_air_date,
        year: show.first_air_date ? new Date(show.first_air_date).getFullYear() : null,
        rating: show.vote_average ? parseFloat(show.vote_average.toFixed(1)) : null,
        voteCount: show.vote_count,
        popularity: show.popularity,
        poster: getImageUrl(show.poster_path, 'w500'),
        posterSmall: getImageUrl(show.poster_path, 'w300'),
        backdrop: getImageUrl(show.backdrop_path, 'w1280'),
        backdropOriginal: getImageUrl(show.backdrop_path, 'original'),
        genreIds: show.genre_ids || [],
        originalLanguage: show.original_language,
        mediaType: 'tv',
    };
}

/**
 * Transform detailed TV series data
 */
function transformTVDetails(show) {
    return {
        id: show.id,
        title: show.name,
        tagline: show.tagline,
        overview: show.overview,
        releaseDate: show.first_air_date,
        year: show.first_air_date ? new Date(show.first_air_date).getFullYear() : null,
        lastAirDate: show.last_air_date,
        status: show.status,
        rating: show.vote_average ? parseFloat(show.vote_average.toFixed(1)) : null,
        voteCount: show.vote_count,
        popularity: show.popularity,
        poster: getImageUrl(show.poster_path, 'w500'),
        posterLarge: getImageUrl(show.poster_path, 'w780'),
        backdrop: getImageUrl(show.backdrop_path, 'w1280'),
        backdropOriginal: getImageUrl(show.backdrop_path, 'original'),
        genres: show.genres || [],
        numberOfSeasons: show.number_of_seasons,
        numberOfEpisodes: show.number_of_episodes,
        seasons: show.seasons?.filter(s => s.season_number > 0).map(s => ({
            id: s.id,
            name: s.name,
            seasonNumber: s.season_number,
            episodeCount: s.episode_count,
            airDate: s.air_date,
            poster: getImageUrl(s.poster_path, 'w300'),
            overview: s.overview,
        })) || [],
        networks: show.networks?.map(n => ({
            id: n.id,
            name: n.name,
            logo: getImageUrl(n.logo_path, 'w200'),
        })) || [],
        productionCompanies: show.production_companies?.map(c => ({
            id: c.id,
            name: c.name,
            logo: getImageUrl(c.logo_path, 'w200'),
        })) || [],
        homepage: show.homepage,
        mediaType: 'tv',
    };
}

/**
 * Transform episode data
 */
function transformEpisode(episode) {
    return {
        id: episode.id,
        name: episode.name,
        overview: episode.overview,
        episodeNumber: episode.episode_number,
        seasonNumber: episode.season_number,
        airDate: episode.air_date,
        runtime: episode.runtime,
        rating: episode.vote_average ? parseFloat(episode.vote_average.toFixed(1)) : null,
        still: getImageUrl(episode.still_path, 'w300'),
        stillLarge: getImageUrl(episode.still_path, 'w500'),
    };
}

// ============= API Methods =============

/**
 * Get trending movies
 * @param {string} timeWindow - 'day' or 'week'
 */
export async function getTrending(timeWindow = 'day') {
    const data = await tmdbFetch(`/trending/movie/${timeWindow}`);
    return {
        results: data.results.filter(m => m.poster_path).map(transformMovie),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Get popular movies
 */
export async function getPopular(page = 1) {
    const data = await tmdbFetch('/movie/popular', { page });
    return {
        results: data.results.filter(m => m.poster_path).map(transformMovie),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Get top rated movies
 */
export async function getTopRated(page = 1) {
    const data = await tmdbFetch('/movie/top_rated', { page });
    return {
        results: data.results.filter(m => m.poster_path).map(transformMovie),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Get now playing movies
 */
export async function getNowPlaying(page = 1) {
    const data = await tmdbFetch('/movie/now_playing', { page });
    return {
        results: data.results.filter(m => m.poster_path).map(transformMovie),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Get upcoming movies
 */
export async function getUpcoming(page = 1) {
    const data = await tmdbFetch('/movie/upcoming', { page });
    return {
        results: data.results.filter(m => m.poster_path).map(transformMovie),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Get movie details by ID
 */
export async function getMovieDetails(movieId) {
    const data = await tmdbFetch(`/movie/${movieId}`);
    return transformMovieDetails(data);
}

/**
 * Get movie credits (cast and crew)
 */
export async function getMovieCredits(movieId) {
    const data = await tmdbFetch(`/movie/${movieId}/credits`);
    return {
        cast: data.cast?.slice(0, 20).map(transformCastMember) || [],
        crew: data.crew?.slice(0, 10).map(member => ({
            id: member.id,
            name: member.name,
            job: member.job,
            department: member.department,
            profileImage: getImageUrl(member.profile_path, 'w185'),
        })) || [],
    };
}

/**
 * Get movie images
 */
export async function getMovieImages(movieId) {
    const data = await tmdbFetch(`/movie/${movieId}/images`);
    return {
        backdrops: data.backdrops?.slice(0, 20).map(img => ({
            path: getImageUrl(img.file_path, 'w780'),
            pathOriginal: getImageUrl(img.file_path, 'original'),
            width: img.width,
            height: img.height,
            aspectRatio: img.aspect_ratio,
        })) || [],
        posters: data.posters?.slice(0, 10).map(img => ({
            path: getImageUrl(img.file_path, 'w500'),
            pathOriginal: getImageUrl(img.file_path, 'original'),
            width: img.width,
            height: img.height,
            aspectRatio: img.aspect_ratio,
        })) || [],
        logos: data.logos?.slice(0, 5).map(img => ({
            path: getImageUrl(img.file_path, 'w500'),
            pathOriginal: getImageUrl(img.file_path, 'original'),
            width: img.width,
            height: img.height,
        })) || [],
    };
}

/**
 * Get movie videos (trailers, teasers, etc.)
 */
export async function getMovieVideos(movieId) {
    const data = await tmdbFetch(`/movie/${movieId}/videos`);
    return {
        results: data.results?.map(video => ({
            id: video.id,
            key: video.key,
            name: video.name,
            site: video.site,
            type: video.type,
            official: video.official,
            publishedAt: video.published_at,
            // YouTube embed URL
            embedUrl: video.site === 'YouTube' ? `https://www.youtube.com/embed/${video.key}` : null,
            thumbnailUrl: video.site === 'YouTube' ? `https://img.youtube.com/vi/${video.key}/hqdefault.jpg` : null,
        })) || [],
    };
}

/**
 * Get similar movies
 */
export async function getSimilarMovies(movieId, page = 1) {
    const data = await tmdbFetch(`/movie/${movieId}/similar`, { page });
    return {
        results: data.results.filter(m => m.poster_path).map(transformMovie),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Get movie recommendations
 */
export async function getMovieRecommendations(movieId, page = 1) {
    const data = await tmdbFetch(`/movie/${movieId}/recommendations`, { page });
    return {
        results: data.results.filter(m => m.poster_path).map(transformMovie),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Search movies
 */
export async function searchMovies(query, page = 1) {
    const data = await tmdbFetch('/search/movie', { query, page });
    return {
        results: data.results.filter(m => m.poster_path).map(transformMovie),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Search both movies and TV shows (multi-search)
 */
export async function searchMulti(query, page = 1) {
    const data = await tmdbFetch('/search/multi', { query, page });

    // Filter to only movies and TV shows WITH POSTER, transform accordingly
    const results = data.results
        .filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path)
        .map(item => {
            if (item.media_type === 'movie') {
                return { ...transformMovie(item), mediaType: 'movie' };
            } else {
                return { ...transformTVSeries(item), mediaType: 'tv' };
            }
        });

    return {
        results,
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Discover movies with filters
 */
export async function discoverMovies(options = {}) {
    const {
        page = 1,
        sortBy = 'popularity.desc',
        year,
        genre,
        minRating,
        maxRating,
    } = options;

    const params = {
        page,
        sort_by: sortBy,
        include_adult: false,
        include_video: false,
    };

    if (year) params.primary_release_year = year;
    if (genre) params.with_genres = genre;
    if (minRating) params['vote_average.gte'] = minRating;
    if (maxRating) params['vote_average.lte'] = maxRating;

    const data = await tmdbFetch('/discover/movie', params);
    return {
        results: data.results.filter(m => m.poster_path).map(transformMovie),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Get all movie genres
 */
export async function getGenres() {
    const data = await tmdbFetch('/genre/movie/list');
    return data.genres;
}

/**
 * Get random movies (using discover with random page)
 */
export async function getRandomMovies() {
    // Get a random page from popular movies (up to page 20)
    const randomPage = Math.floor(Math.random() * 20) + 1;
    const data = await tmdbFetch('/discover/movie', {
        page: randomPage,
        sort_by: 'popularity.desc',
        'vote_average.gte': 6,
        'vote_count.gte': 100,
    });

    // Shuffle the results
    const shuffled = data.results
        .sort(() => Math.random() - 0.5)
        .slice(0, 20);

    return {
        results: shuffled.map(transformMovie),
        page: 1,
        totalPages: 1,
        totalResults: shuffled.length,
    };
}

// ============= TV Series API Methods =============

/**
 * Get TV series details by ID
 */
export async function getTVDetails(seriesId) {
    const data = await tmdbFetch(`/tv/${seriesId}`);
    return transformTVDetails(data);
}

/**
 * Get TV season details with episodes
 */
export async function getTVSeasonDetails(seriesId, seasonNumber) {
    const data = await tmdbFetch(`/tv/${seriesId}/season/${seasonNumber}`);
    return {
        id: data.id,
        name: data.name,
        overview: data.overview,
        seasonNumber: data.season_number,
        airDate: data.air_date,
        poster: getImageUrl(data.poster_path, 'w300'),
        episodes: data.episodes?.map(transformEpisode) || [],
    };
}

/**
 * Get similar TV shows
 */
export async function getSimilarTV(seriesId, page = 1) {
    const data = await tmdbFetch(`/tv/${seriesId}/similar`, { page });
    return {
        results: data.results.filter(m => m.poster_path).map(transformTVSeries),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Search TV shows
 */
export async function searchTV(query, page = 1) {
    const data = await tmdbFetch('/search/tv', { query, page });
    return {
        results: data.results.filter(m => m.poster_path).map(transformTVSeries),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Get TV series credits (cast and crew)
 */
export async function getTVCredits(seriesId) {
    const data = await tmdbFetch(`/tv/${seriesId}/credits`);
    return {
        cast: data.cast?.slice(0, 20).map(transformCastMember) || [],
        crew: data.crew?.slice(0, 10).map(member => ({
            id: member.id,
            name: member.name,
            job: member.job,
            department: member.department,
            profileImage: getImageUrl(member.profile_path, 'w185'),
        })) || [],
    };
}

/**
 * Get trending TV shows
 */
export async function getTrendingTV(timeWindow = 'day') {
    const data = await tmdbFetch(`/trending/tv/${timeWindow}`);
    return {
        results: data.results.filter(m => m.poster_path).map(transformTVSeries),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Get popular TV shows
 */
export async function getPopularTV(page = 1) {
    const data = await tmdbFetch('/tv/popular', { page });
    return {
        results: data.results.filter(m => m.poster_path).map(transformTVSeries),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Get top rated TV shows
 */
export async function getTopRatedTV(page = 1) {
    const data = await tmdbFetch('/tv/top_rated', { page });
    return {
        results: data.results.filter(m => m.poster_path).map(transformTVSeries),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Get currently airing TV shows
 */
export async function getAiringTV() {
    const data = await tmdbFetch('/tv/on_the_air');
    return {
        results: data.results.filter(m => m.poster_path).map(transformTVSeries),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

// ============================================
// Person/Actor API Functions
// ============================================

/**
 * Transform person data to our format
 */
function transformPerson(person) {
    return {
        id: person.id,
        name: person.name,
        biography: person.biography,
        birthday: person.birthday,
        deathday: person.deathday,
        birthplace: person.place_of_birth,
        knownFor: person.known_for_department,
        popularity: person.popularity,
        profileImage: getImageUrl(person.profile_path, 'w500'),
        profileImageLarge: getImageUrl(person.profile_path, 'original'),
        gender: person.gender, // 1 = Female, 2 = Male
        homepage: person.homepage,
        alsoKnownAs: person.also_known_as || [],
    };
}

/**
 * Get person details
 */
export async function getPersonDetails(personId) {
    const data = await tmdbFetch(`/person/${personId}`);
    return transformPerson(data);
}

/**
 * Get person movie credits
 */
export async function getPersonMovieCredits(personId) {
    const data = await tmdbFetch(`/person/${personId}/movie_credits`);
    return {
        cast: data.cast?.sort((a, b) => {
            const dateA = a.release_date ? new Date(a.release_date) : new Date(0);
            const dateB = b.release_date ? new Date(b.release_date) : new Date(0);
            return dateB - dateA; // Sort by newest first
        }).slice(0, 30).map(movie => ({
            ...transformMovie(movie),
            character: movie.character,
        })) || [],
        crew: data.crew?.slice(0, 10).map(movie => ({
            ...transformMovie(movie),
            job: movie.job,
            department: movie.department,
        })) || [],
    };
}

/**
 * Get person TV credits
 */
export async function getPersonTVCredits(personId) {
    const data = await tmdbFetch(`/person/${personId}/tv_credits`);
    return {
        cast: data.cast?.sort((a, b) => {
            const dateA = a.first_air_date ? new Date(a.first_air_date) : new Date(0);
            const dateB = b.first_air_date ? new Date(b.first_air_date) : new Date(0);
            return dateB - dateA; // Sort by newest first
        }).slice(0, 30).map(show => ({
            ...transformTVSeries(show),
            character: show.character,
            episodeCount: show.episode_count,
        })) || [],
        crew: data.crew?.slice(0, 10).map(show => ({
            ...transformTVSeries(show),
            job: show.job,
            department: show.department,
        })) || [],
    };
}

/**
 * Get person images
 */
export async function getPersonImages(personId) {
    const data = await tmdbFetch(`/person/${personId}/images`);
    return {
        profiles: data.profiles?.map(img => ({
            path: getImageUrl(img.file_path, 'w500'),
            pathLarge: getImageUrl(img.file_path, 'original'),
            aspectRatio: img.aspect_ratio,
            width: img.width,
            height: img.height,
        })) || [],
    };
}

/**
 * Get combined credits (movies and TV)
 */
export async function getPersonCombinedCredits(personId) {
    const data = await tmdbFetch(`/person/${personId}/combined_credits`);
    return {
        cast: data.cast?.sort((a, b) => {
            const dateA = a.release_date || a.first_air_date
                ? new Date(a.release_date || a.first_air_date)
                : new Date(0);
            const dateB = b.release_date || b.first_air_date
                ? new Date(b.release_date || b.first_air_date)
                : new Date(0);
            return dateB - dateA;
        }).slice(0, 50).map(item => {
            const isMovie = item.media_type === 'movie';
            return {
                id: item.id,
                title: isMovie ? item.title : item.name,
                poster: getImageUrl(item.poster_path, 'w342'),
                year: isMovie
                    ? (item.release_date ? new Date(item.release_date).getFullYear() : null)
                    : (item.first_air_date ? new Date(item.first_air_date).getFullYear() : null),
                rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : null,
                character: item.character,
                mediaType: item.media_type,
            };
        }) || [],
    };
}

// ============= Anime API Methods =============
// Uses TMDB's discover/tv filtered by Animation genre (16) and Japanese origin

/**
 * Get trending anime (animation + Japanese origin)
 */
export async function getTrendingAnime() {
    const data = await tmdbFetch('/discover/tv', {
        with_genres: 16, // Animation
        with_origin_country: 'JP',
        sort_by: 'popularity.desc',
        'vote_count.gte': 50,
    });
    return {
        results: data.results.filter(m => m.poster_path).map(transformTVSeries),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Get popular anime
 */
export async function getPopularAnime(page = 1) {
    const data = await tmdbFetch('/discover/tv', {
        with_genres: 16,
        with_origin_country: 'JP',
        sort_by: 'popularity.desc',
        page,
    });
    return {
        results: data.results.filter(m => m.poster_path).map(transformTVSeries),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Get top rated anime
 */
export async function getTopRatedAnime(page = 1) {
    const data = await tmdbFetch('/discover/tv', {
        with_genres: 16,
        with_origin_country: 'JP',
        sort_by: 'vote_average.desc',
        'vote_count.gte': 200,
        page,
    });
    return {
        results: data.results.filter(m => m.poster_path).map(transformTVSeries),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Get airing today anime
 */
export async function getAiringAnime() {
    const data = await tmdbFetch('/discover/tv', {
        with_genres: 16,
        with_origin_country: 'JP',
        'air_date.gte': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        sort_by: 'popularity.desc',
    });
    return {
        results: data.results.filter(m => m.poster_path).map(transformTVSeries),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Discover anime with filters
 */
export async function discoverAnime(options = {}) {
    const {
        page = 1,
        sortBy = 'popularity.desc',
        year,
        genre, // Additional genre on top of Animation (16)
    } = options;

    const params = {
        page,
        sort_by: sortBy,
        with_genres: genre ? `16,${genre}` : 16, // Always include Animation, optionally add more
        with_origin_country: 'JP',
    };

    if (year) params.first_air_date_year = year;
    if (sortBy === 'vote_average.desc') params['vote_count.gte'] = 100;

    const data = await tmdbFetch('/discover/tv', params);
    return {
        results: data.results.filter(m => m.poster_path).map(transformTVSeries),
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
    };
}

/**
 * Get anime/TV genres
 */
export async function getAnimeGenres() {
    const data = await tmdbFetch('/genre/tv/list');
    // Filter out Animation since it's always applied
    return data.genres.filter(g => g.id !== 16);
}


