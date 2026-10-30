import {
  LIST_CACHE_TTL,
  TMDB_BASE_URL,
  TMDB_READ_ACCESS_TOKEN,
  TMDB_REGION,
} from "../config.js";
import { cachedFetch } from "./cache.js";
import { getTmdbImage, normaliseTmdbItem } from "./normalise.js";

const ANIMATION_GENRE_ID = 16;

const headers = {
  Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`,
  accept: "application/json",
};

function buildUrl(path, params = {}) {
  const url = new URL(TMDB_BASE_URL + path);
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(name, value);
    }
  });
  return url.toString();
}

// Anime lives on its own tab (from AniList), so Japanese animation is kept out of Movies and TV.
// Language catches anime that TMDB files under another country, like Solo Leveling; Pixar stays in.
function isAnime(item) {
  return (
    item.genre_ids?.includes(ANIMATION_GENRE_ID) &&
    (item.original_language === "ja" || item.origin_country?.includes("JP"))
  );
}

async function getPage(url, type, page) {
  const { data, savedAt, isStale } = await cachedFetch(url, { headers });
  const items = data.results.filter((item) => !isAnime(item));
  return {
    results: items.map((item) => normaliseTmdbItem(item, type)),
    // TMDB's total includes what was filtered out, so it's only shown when nothing was.
    count: items.length === data.results.length ? data.total_results : null,
    page,
    hasMore: page < data.total_pages,
    savedAt,
    isStale,
  };
}

export function getMovies({ start, end, genres, page = 1 } = {}) {
  const url = buildUrl("/discover/movie", {
    "primary_release_date.gte": start,
    "primary_release_date.lte": end,
    with_genres: genres,
    region: TMDB_REGION,
    sort_by: "popularity.desc",
    page,
  });
  return getPage(url, "movie", page);
}

// What's showing in South African cinemas right now (#77).
export function getNowPlaying({ page = 1 } = {}) {
  const url = buildUrl("/movie/now_playing", { region: TMDB_REGION, page });
  return getPage(url, "movie", page);
}

const MIN_SHOW_RESULTS = 12;
const MAX_SHOW_PAGES = 3;

function isInRange(isoDate, start, end) {
  return Boolean(isoDate) && isoDate >= start && isoDate <= end;
}

// /discover/tv returns any show with an episode in range, so long-running shows (soaps, talk shows)
// come back with premiere dates from decades ago. Only keep real drops: a brand-new show or a
// season premiere inside the range, and use that date on the card.
async function getSeasonDrop(id, start, end) {
  const { data } = await cachedFetch(buildUrl(`/tv/${id}`), { headers });
  if (isInRange(data.first_air_date, start, end)) {
    return { date: data.first_air_date, season: 1 };
  }
  const premiere = [data.next_episode_to_air, data.last_episode_to_air].find(
    (episode) =>
      episode?.episode_number === 1 && isInRange(episode.air_date, start, end),
  );
  return premiere
    ? { date: premiere.air_date, season: premiere.season_number }
    : null;
}

// Filtering leaves fewer results per TMDB page, so keep reading pages until there are enough to fill the grid.
async function getSeasonDrops(type, filters, { start, end, page = 1 }) {
  const results = [];
  let current = page;
  let totalPages = page;
  let savedAt = Date.now();
  let isStale = false;

  while (
    results.length < MIN_SHOW_RESULTS &&
    current < page + MAX_SHOW_PAGES &&
    current <= totalPages
  ) {
    const url = buildUrl("/discover/tv", {
      ...filters,
      "air_date.gte": start,
      "air_date.lte": end,
      sort_by: "popularity.desc",
      page: current,
    });
    const response = await cachedFetch(url, { headers });
    totalPages = response.data.total_pages;
    savedAt = Math.min(savedAt, response.savedAt);
    isStale ||= response.isStale;

    const items = response.data.results;
    const drops = await Promise.all(
      items.map((item) => getSeasonDrop(item.id, start, end).catch(() => null)),
    );
    items.forEach((item, index) => {
      if (!drops[index]) return;
      results.push({
        ...normaliseTmdbItem(item, type),
        ...drops[index],
        tba: false,
      });
    });
    current += 1;
  }

  return {
    results,
    count: null,
    page: current - 1,
    hasMore: current <= totalPages,
    savedAt,
    isStale,
  };
}

export function getShows({ start, end, genres, page = 1 } = {}) {
  return getSeasonDrops(
    "tv",
    { with_genres: genres, without_genres: ANIMATION_GENRE_ID },
    { start, end, page },
  );
}

export function searchMovies({ query, page = 1 } = {}) {
  const url = buildUrl("/search/movie", { query, region: TMDB_REGION, page });
  return getPage(url, "movie", page);
}

// TMDB search has one TV list, so anime (now from AniList) is taken out here. Like getSeasonDrops,
// keep reading pages until there are enough results to show.
async function searchTv(type, keep, { query, page = 1 }) {
  const results = [];
  let current = page;
  let totalPages = page;
  let savedAt = Date.now();
  let isStale = false;

  while (
    results.length < MIN_SHOW_RESULTS &&
    current < page + MAX_SHOW_PAGES &&
    current <= totalPages
  ) {
    const url = buildUrl("/search/tv", { query, page: current });
    const response = await cachedFetch(url, { headers });
    totalPages = response.data.total_pages;
    savedAt = Math.min(savedAt, response.savedAt);
    isStale ||= response.isStale;
    response.data.results
      .filter(keep)
      .forEach((item) => results.push(normaliseTmdbItem(item, type)));
    current += 1;
  }

  return {
    results,
    count: null,
    page: current - 1,
    hasMore: current <= totalPages,
    savedAt,
    isStale,
  };
}

export function searchShows(options) {
  return searchTv("tv", (item) => !isAnime(item), options);
}

// kind is "movie" or "tv"; TMDB keeps a separate genre list for each.
export async function getGenres(kind) {
  const { data } = await cachedFetch(buildUrl(`/genre/${kind}/list`), {
    headers,
    maxAge: LIST_CACHE_TTL,
  });
  return data.genres.map(({ id, name }) => ({ id, name }));
}

function toQuickView(data, type) {
  const providers = data["watch/providers"]?.results?.[TMDB_REGION];
  const trailer = data.videos?.results?.find(
    (video) => video.site === "YouTube" && video.type === "Trailer",
  );
  return {
    ...normaliseTmdbItem(
      { ...data, genre_ids: (data.genres ?? []).map((genre) => genre.id) },
      type,
    ),
    overview: data.overview ?? "",
    runtime: data.runtime ?? null,
    seasons: data.number_of_seasons ?? null,
    nextEpisodeDate: data.next_episode_to_air?.air_date ?? null,
    providers: (providers?.flatrate ?? []).map((provider) => ({
      name: provider.provider_name,
      logo: getTmdbImage(provider.logo_path, "w92"),
    })),
    trailerKey: trailer?.key ?? null,
    logo: pickLogo(data.images?.logos),
  };
}

// The title treatment (the film's own logo), like the top of Netflix and Apple TV. English first,
// then one with no language. Anything else would show a title in a script the page isn't in.
function pickLogo(logos = []) {
  const logo = logos.find((item) => item.iso_639_1 === "en") ?? logos.find((item) => item.iso_639_1 === null);
  return logo ? getTmdbImage(logo.file_path, "w500") : null;
}

export async function getMovie(id) {
  const url = buildUrl(`/movie/${id}`, {
    append_to_response: "watch/providers,videos,images",
    include_image_language: "en,null",
  });
  const { data } = await cachedFetch(url, { headers });
  return toQuickView(data, "movie");
}

export async function getShow(id, type = "tv") {
  const url = buildUrl(`/tv/${id}`, {
    append_to_response: "watch/providers,videos,images",
    include_image_language: "en,null",
  });
  const { data } = await cachedFetch(url, { headers });
  return toQuickView(data, type);
}
