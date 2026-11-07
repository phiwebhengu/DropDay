import { GAMES_API_URL } from "../config.js";
import { addDays, toIsoDate } from "../utils/dates.js";
import { cachedFetch } from "./cache.js";
import { normaliseIgdbGame, normaliseIgdbGameDetail } from "./normalise.js";

// Game data comes from IGDB through Drop Day's own Cloudflare Worker (proxy/igdb-worker.js), which keeps
// the Twitch key secret and only answers the questions below. The site used RAWG until it went down for
// days in November 2026.

const ANTICIPATED_COUNT = 10;
const ANTICIPATED_DAYS = 90;

// IGDB's own ids. These lists don't change, so they live here instead of costing a request each visit.
export const PLATFORMS = {
  pc: 6,
  ps5: 167,
  xboxSeries: 169,
  switch2: 508,
  switch: 130,
};

const CURRENT_PLATFORMS = [
  { id: PLATFORMS.pc, name: "PC" },
  { id: PLATFORMS.ps5, name: "PlayStation 5" },
  { id: PLATFORMS.xboxSeries, name: "Xbox Series S/X" },
  { id: PLATFORMS.switch2, name: "Nintendo Switch 2" },
  { id: PLATFORMS.switch, name: "Nintendo Switch" },
];

const OLDER_PLATFORMS = [
  { id: 48, name: "PlayStation 4" },
  { id: 49, name: "Xbox One" },
  { id: 39, name: "iOS" },
  { id: 34, name: "Android" },
  { id: 14, name: "macOS" },
  { id: 3, name: "Linux" },
];

const GENRES = [
  { id: 31, name: "Adventure" },
  { id: 12, name: "RPG" },
  { id: 5, name: "Shooter" },
  { id: 8, name: "Platform" },
  { id: 9, name: "Puzzle" },
  { id: 10, name: "Racing" },
  { id: 14, name: "Sport" },
  { id: 4, name: "Fighting" },
  { id: 15, name: "Strategy" },
  { id: 13, name: "Simulator" },
  { id: 25, name: "Hack and slash" },
  { id: 33, name: "Arcade" },
  { id: 32, name: "Indie" },
  { id: 34, name: "Visual novel" },
  { id: 35, name: "Card and board" },
  { id: 7, name: "Music" },
];

function buildUrl(path, params = {}) {
  const url = new URL(path, GAMES_API_URL);
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, value);
  });
  return url.toString();
}

function toPage({ data, savedAt, isStale }, page) {
  return {
    results: data.results.map(normaliseIgdbGame),
    // The Worker filters out adult games and DLC after asking IGDB, so an exact total isn't known.
    count: null,
    page,
    hasMore: data.hasMore,
    savedAt,
    isStale,
  };
}

// ordering "-added" (the old RAWG name) and "hype" both mean most anticipated first; anything else is by date.
export async function getGames({ start, end, platforms, genres, search, ordering, page = 1 } = {}) {
  if (search) return toPage(await cachedFetch(buildUrl("search", { q: search, page })), page);
  const sort = ordering === "-added" || ordering === "hype" ? "hype" : "date";
  const url = buildUrl("games", { from: start, to: end, sort, genre: genres, platform: platforms, page });
  return toPage(await cachedFetch(url), page);
}

// The most anticipated games of the next 90 days, by how many people on IGDB are waiting for them.
export async function getAnticipated(today = new Date()) {
  const { results, savedAt, isStale } = await getGames({
    start: toIsoDate(today),
    end: toIsoDate(addDays(today, ANTICIPATED_DAYS)),
    ordering: "hype",
  });
  return { results: results.filter((game) => game.date).slice(0, ANTICIPATED_COUNT), savedAt, isStale };
}

export async function getFeaturedGame(today = new Date()) {
  const { results, savedAt, isStale } = await getAnticipated(today);
  return { game: results[0] ?? null, savedAt, isStale };
}

// One request brings the whole page: details, screenshots, trailer, editions and similar games.
// A direct link to an adult game comes back empty, so the page shows it as not found.
export async function getGame(id) {
  const { data, savedAt, isStale } = await cachedFetch(buildUrl("game", { id }));
  return { game: data.game ? normaliseIgdbGameDetail(data.game) : null, savedAt, isStale };
}

export async function getScreenshots(id) {
  return (await getGame(id)).game?.screenshots ?? [];
}

export async function getTrailer(id) {
  const key = (await getGame(id)).game?.trailerKey;
  return key ? { youtubeId: key } : null;
}

export async function getEditions(id) {
  return (await getGame(id)).game?.editions ?? [];
}

export async function getSimilarGames(id, limit = 6) {
  return ((await getGame(id)).game?.similar ?? []).slice(0, limit);
}

// Games saved while the site used RAWG are found again on IGDB by name, preferring the same year.
export async function findGame({ title, date }) {
  const { results } = await getGames({ search: title });
  const sameName = results.filter((game) => game.title.toLowerCase() === title.toLowerCase());
  const year = date?.slice(0, 4);
  return sameName.find((game) => game.date?.slice(0, 4) === year) ?? sameName[0] ?? null;
}

export function getPlatforms() {
  return { current: CURRENT_PLATFORMS, older: OLDER_PLATFORMS };
}

export async function getGenres() {
  return GENRES;
}

