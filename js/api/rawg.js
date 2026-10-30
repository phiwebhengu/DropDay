import {
  RAWG_API_KEY,
  RAWG_BASE_URL,
  PAGE_SIZE,
  LIST_CACHE_TTL,
} from "../config.js";
import { addDays, toIsoDate } from "../utils/dates.js";

const FEATURED_CANDIDATES = 20;

// RAWG has no adult flag (TMDB and AniList do), so explicit games are caught here before anything renders.
// Checked against real RAWG data: many explicit games carry no tell-tale tag at all, so three signals are used.
const ADULT_TAGS = new Set(["nsfw", "hentai", "khentai", "eroge", "erotic", "porn", "adult"]);
// These also sit on mainstream games like The Witcher 3, which always have an age rating; explicit games don't.
const MATURE_TAGS = new Set(["nudity", "sexual-content", "nagota", "seksualnyi-kontent"]);
const ADULT_TITLE = /\b(futa|futanari|hentai|nsfw|porn|porno|xxx|erotic|eroge|lewd|nude|nudes|sexy|sex|milf|femboy)\b/i;

function isAdult(game) {
  if (game.esrb_rating?.slug === "adults-only") return true;
  if (ADULT_TITLE.test(game.name ?? "")) return true;
  const tags = (game.tags ?? []).map((tag) => tag.slug);
  if (tags.some((tag) => ADULT_TAGS.has(tag))) return true;
  return !game.esrb_rating && tags.some((tag) => MATURE_TAGS.has(tag));
}

// Browsing lists only show games at least one RAWG user is tracking, the way Letterboxd surfaces films people
// actually log. It clears out untracked shovelware and adult uploads; searching by name still finds anything.
function isListed(game, { tracked }) {
  if (isAdult(game)) return false;
  return !tracked || game.added !== 0;
}
import { cachedFetch } from "./cache.js";
import { addCovers } from "./igdb.js";
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

async function toPage(response, page, { tracked = true } = {}) {
  const { data, savedAt, isStale } = response;
  const games = data.results.filter((game) => isListed(game, { tracked }));
  return {
    results: await addCovers(games.map(normaliseRawgGame)),
    // RAWG's total includes what was filtered out, so it's only shown when nothing was.
    count: games.length === data.results.length ? data.count : null,
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
  return toPage(await cachedFetch(url), page, { tracked: !search });
}

const ANTICIPATED_COUNT = 10;

// The most-added games of the next 90 days. RAWG counts some TBA games as "in range" through a
// placeholder date, so only games with a real date are kept (the billboard needs one for its countdown).
export async function getAnticipated(today = new Date()) {
  const url = buildUrl("/games", {
    dates: `${toIsoDate(today)},${toIsoDate(addDays(today, 90))}`,
    ordering: "-added",
    page_size: FEATURED_CANDIDATES,
  });
  const { results, savedAt, isStale } = await toPage(await cachedFetch(url), 1);
  const games = results.filter((result) => !result.tba && result.date).slice(0, ANTICIPATED_COUNT);
  return { results: games, savedAt, isStale };
}

export async function getFeaturedGame(today = new Date()) {
  const { results, savedAt, isStale } = await getAnticipated(today);
  return { game: results[0] ?? null, savedAt, isStale };
}

// A direct link to an adult game opens nothing: the game page shows it as not found.
export async function getGame(id) {
  const { data, savedAt, isStale } = await cachedFetch(
    buildUrl(`/games/${id}`),
  );
  const game = isAdult(data) ? null : (await addCovers([normaliseRawgGameDetail(data)]))[0];
  return { game, savedAt, isStale };
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
  const { results } = await toPage(await cachedFetch(url), 1);
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
