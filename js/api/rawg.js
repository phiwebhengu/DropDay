import {
  RAWG_API_KEY,
  RAWG_BASE_URL,
  PAGE_SIZE,
  LIST_CACHE_TTL,
} from "../config.js";
import { addDays, toIsoDate } from "../utils/dates.js";

const FEATURED_CANDIDATES = 10;

// RAWG has no filter for adult games, so they are dropped here before anything renders. Only adult-only
// tags count: "nudity" and "sexual-content" also sit on mainstream mature games like The Witcher 3.
const ADULT_TAGS = new Set(["nsfw", "hentai"]);

function isSafe(game) {
  if (game.esrb_rating?.slug === "adults-only") return false;
  return !(game.tags ?? []).some((tag) => ADULT_TAGS.has(tag.slug));
}
import { cachedFetch } from "./cache.js";
import {
  normaliseRawgGame,
  normaliseRawgGameDetail,
  resizeRawgImage,
} from "./normalise.js";

function buildUrl(path, params = {}) {
  const url = new URL(RAWG_BASE_URL + path);
  url.searchParams.set("key", RAWG_API_KEY);
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(name, value);
    }
  });
  return url.toString();
}

function toPage(response, page) {
  const { data, savedAt, isStale } = response;
  return {
    results: data.results.filter(isSafe).map(normaliseRawgGame),
    count: data.count,
    page,
    hasMore: Boolean(data.next),
    savedAt,
    isStale,
  };
}

export async function getGames({
  start,
  end,
  platforms,
  genres,
  search,
  ordering = "released",
  page = 1,
} = {}) {
  const url = buildUrl("/games", {
    dates: start && end ? `${start},${end}` : undefined,
    platforms,
    genres,
    search,
    search_precise: search ? true : undefined,
    // Search defaults to RAWG's relevance order, which ranks fan games above the real thing; most added comes first instead.
    ordering: search ? "-added" : ordering,
    page,
    page_size: PAGE_SIZE,
  });
  return toPage(await cachedFetch(url), page);
}

// RAWG counts some TBA games as "in range" through a placeholder date, so it asks for a few and
// features the most-added one with a real date (the hero needs one for its countdown).
export async function getFeaturedGame(today = new Date()) {
  const url = buildUrl("/games", {
    dates: `${toIsoDate(today)},${toIsoDate(addDays(today, 90))}`,
    ordering: "-added",
    page_size: FEATURED_CANDIDATES,
  });
  const { results, savedAt, isStale } = toPage(await cachedFetch(url), 1);
  const game = results.find((result) => !result.tba && result.date) ?? null;
  return { game, savedAt, isStale };
}

export async function getGame(id) {
  const { data, savedAt, isStale } = await cachedFetch(
    buildUrl(`/games/${id}`),
  );
  return { game: normaliseRawgGameDetail(data), savedAt, isStale };
}

export async function getScreenshots(id) {
  const { data } = await cachedFetch(buildUrl(`/games/${id}/screenshots`));
  return data.results.map((screenshot) => resizeRawgImage(screenshot.image));
}

// RAWG only has clips for some games, so this resolves to null when there's nothing to play.
export async function getTrailer(id) {
  const { data } = await cachedFetch(buildUrl(`/games/${id}/movies`));
  const movie = data.results?.[0];
  const src = movie?.data?.["480"] ?? movie?.data?.max;
  return src ? { src, name: movie.name } : null;
}

export async function getEditions(id) {
  const { data } = await cachedFetch(buildUrl(`/games/${id}/additions`));
  return data.results.map((addition) => addition.name);
}

export async function getSimilarGames(id, genreIds, limit = 6) {
  if (!genreIds.length) return [];
  const url = buildUrl("/games", {
    genres: genreIds.slice(0, 2).join(","),
    ordering: "-added",
    page_size: limit + 1,
  });
  const { results } = toPage(await cachedFetch(url), 1);
  return results.filter((game) => game.id !== Number(id)).slice(0, limit);
}

export async function getPlatforms() {
  const { data } = await cachedFetch(
    buildUrl("/platforms", { page_size: 40 }),
    { maxAge: LIST_CACHE_TTL },
  );
  return data.results.map(({ id, name, games_count }) => ({
    id,
    name,
    gamesCount: games_count,
  }));
}

export async function getGenres() {
  const { data } = await cachedFetch(buildUrl("/genres", { page_size: 40 }), {
    maxAge: LIST_CACHE_TTL,
  });
  return data.results.map(({ id, name }) => ({ id, name }));
}
