export const RAWG_API_KEY = "987bcaf1e64845db8f9628c97b96452b";
export const TMDB_READ_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1NTAwZGRhZTAzOTYwZGMyYjI5OTk0NmZjNjExYTNjOCIsIm5iZiI6MTc5MjQzNzc4Mi4zMjksInN1YiI6IjZhZDY2ZTE2YzE3YTdkZDMxOWMwMTZjZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.FLcgx9_86G0zdQjNb46GXud30rt-BdmAtEjtxP5DzLs";

// Restrict this key to your site's address in Google Cloud. Left empty, the hero falls back to RAWG's clips.
export const YOUTUBE_API_KEY = "AIzaSyAP52Y6Y74yq5nKbdzN8gygAiDuJVb3rNQ";

export const RAWG_BASE_URL = "https://api.rawg.io/api";
export const TMDB_BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
export const ANILIST_URL = "https://graphql.anilist.co";
// Drop Day's own Cloudflare Worker for official game covers (proxy/igdb-worker.js). Empty = box-art fallback.
export const IGDB_PROXY_URL = "https://dropday-igdb.bhengu080104.workers.dev";
export const YOUTUBE_BASE_URL = "https://www.googleapis.com/youtube/v3";

export const TMDB_REGION = "ZA";
export const PAGE_SIZE = 20;

export const CACHE_TTL = 30 * 60 * 1000;
export const LIST_CACHE_TTL = 24 * 60 * 60 * 1000;
// Each YouTube search costs a lot of the free daily quota, so trailers are kept for a week.
export const TRAILER_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

export const STORAGE_KEYS = {
  igdbCovers: "dropday.igdb.covers.v2",
  library: "dropday.library.v2",
  // The first version's data, kept untouched as a backup after it's carried over.
  legacyLibrary: "dropday.library.v1",
  cachePrefix: "dropday.cache.",
};

export const RAWG_PLATFORMS = {
  xboxSeries: 186,
  ps5: 187,
  pc: 4,
  switch: 7,
};
