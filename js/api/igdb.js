import { IGDB_PROXY_URL, STORAGE_KEYS } from "../config.js";

const IMAGE_BASE = "https://images.igdb.com/igdb/image/upload/t_cover_big_2x";
const TIMEOUT = 3000;
// A game with no cover yet (often an upcoming one) is asked about again after a week.
const MISSING_TTL = 7 * 24 * 60 * 60 * 1000;

function readCovers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.igdbCovers)) ?? {};
  } catch {
    return {};
  }
}

function writeCovers(covers) {
  try {
    localStorage.setItem(STORAGE_KEYS.igdbCovers, JSON.stringify(covers));
  } catch {}
}

function isKnown(entry) {
  return entry && (entry.id || Date.now() - entry.at < MISSING_TTL);
}

// Covers never change, so each game is only asked about once per browser.
// Names and years let the proxy find a game whose IGDB slug differs from RAWG's.
async function fetchCovers(games) {
  const url = new URL("/covers", IGDB_PROXY_URL);
  url.searchParams.set("slugs", games.map((game) => game.slug).join(","));
  url.searchParams.set("names", games.map((game) => game.title.replaceAll("|", " ")).join("|"));
  url.searchParams.set("years", games.map((game) => game.date?.slice(0, 4) ?? "").join(","));
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!response.ok) throw new Error(`Covers failed: ${response.status}`);
  return response.json();
}

// Adds an official 2:3 cover (poster) to each game IGDB has one for. Anything that goes wrong just
// leaves the games as they were, with their RAWG key art.
export async function addCovers(games) {
  if (!IGDB_PROXY_URL || !games.length) return games;
  const covers = readCovers();
  const missing = [
    ...new Map(games.filter((game) => game.slug && !isKnown(covers[game.slug])).map((game) => [game.slug, game])).values(),
  ];

  if (missing.length) {
    try {
      const found = await fetchCovers(missing);
      missing.forEach(({ slug }) => {
        covers[slug] = { id: found[slug] ?? null, at: Date.now() };
      });
      writeCovers(covers);
    } catch {
      return games.map((game) => withCover(game, covers));
    }
  }
  return games.map((game) => withCover(game, covers));
}

function withCover(game, covers) {
  const id = covers[game.slug]?.id;
  return id ? { ...game, poster: `${IMAGE_BASE}/${id}.jpg` } : game;
}
