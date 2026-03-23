import dotenv from 'dotenv';
dotenv.config();

export const config = {
    // Server settings
    port: parseInt(process.env.PORT || '3001'),
    host: process.env.HOST || '0.0.0.0',

    // TMDB API settings
    tmdb: {
        apiKey: process.env.TMDB_API_KEY,
        baseUrl: process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
        imageBaseUrl: 'https://image.tmdb.org/t/p',
    },

    // Cache settings (in seconds)
    cache: {
        trending: 300,      // 5 minutes
        popular: 600,       // 10 minutes
        topRated: 600,      // 10 minutes
        movieDetails: 3600, // 1 hour
        search: 300,        // 5 minutes
    }
};
