// Cloudflare Worker that serves Drop Day's game data from IGDB (owned by Twitch).
// IGDB needs a secret key and blocks requests from browsers, so the site asks this Worker instead.
// Secrets (set with `npx wrangler secret put`, never in this file): TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET.
//
// The Worker only answers these three questions, with the queries written here, so nobody can use it
// as an open door to IGDB:
//   GET /games?from=2026-11-01&to=2026-11-30&sort=date|hype&genre=12&platform=167&page=1
//   GET /search?q=hades&page=1
//   GET /game?id=1942

const ALLOWED_ORIGINS = [
  "https://phiwebhengu.github.io",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
];
const PAGE_SIZE = 20;
const MAX_PAGE = 25;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^\d{1,9}$/;
// IGDB is asked at most once an hour for a list and once every six hours for a game; everyone after
// that gets the Worker's saved copy, which keeps well inside IGDB's 4-requests-a-second limit.
const LIST_CACHE_SECONDS = 60 * 60;
const GAME_CACHE_SECONDS = 6 * 60 * 60;

// The same fields for every card. game_type/category and date_format/category are both asked for:
// IGDB renamed them in 2025 and keeps the old names working for now.
const CARD_FIELDS = [
  "name",
  "slug",
  "first_release_date",
  "release_dates.date",
  "release_dates.date_format",
  "release_dates.category",
  "cover.image_id",
  "artworks.image_id",
  "screenshots.image_id",
  "platforms.id",
  "platforms.name",
  "genres.id",
  "genres.name",
  "themes",
  "total_rating",
  "hypes",
  "game_type",
  "category",
  "version_parent",
];

const DETAIL_FIELDS = [
  ...CARD_FIELDS,
  "summary",
  "storyline",
  "videos.video_id",
  "videos.name",
  "involved_companies.company.name",
  "involved_companies.developer",
  "involved_companies.publisher",
  "expansions.name",
  "dlcs.name",
  ...CARD_FIELDS.map((field) => `similar_games.${field}`),
];

// Erotic is theme 42. IGDB tags explicit games with it, which TMDB and AniList do with an adult flag.
// It's checked here rather than in the query, because a query filter on themes also drops every game
// that has no themes yet (most upcoming ones).
const EROTIC_THEME = 42;
const ADULT_TITLE = /\b(hentai|nsfw|porn|porno|xxx|erotic|eroge|futanari)\b/i;
// Main games, standalone expansions, remakes, remasters, expanded games and ports. Not DLC, bundles,
// mods, episodes, seasons, packs or updates, which aren't release drops of their own.
const RELEASE_TYPES = new Set([0, 4, 8, 9, 10, 11]);
// A release date only counts if IGDB knows the day ("2026" alone is stored as 31 December).
const EXACT_DATE = 0;

let token = null;
let tokenExpiresAt = 0;

async function getToken(env) {
  if (token && Date.now() < tokenExpiresAt) return token;
  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", env.TWITCH_CLIENT_ID);
  url.searchParams.set("client_secret", env.TWITCH_CLIENT_SECRET);
  url.searchParams.set("grant_type", "client_credentials");
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) throw new Error(`Twitch token failed: ${response.status}`);
  const data = await response.json();
  token = data.access_token;
  // Renewed five minutes early, so a request never goes out with a token about to expire.
  tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
  return token;
}

async function queryGames(body, env, retry = true) {
  const response = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${await getToken(env)}`,
      Accept: "application/json",
    },
    body,
  });
  // A revoked token gets one fresh try.
  if (response.status === 401 && retry) {
    token = null;
    return queryGames(body, env, false);
  }
  if (!response.ok) throw new Error(`IGDB failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function isAdult(game) {
  return (game.themes ?? []).includes(EROTIC_THEME) || ADULT_TITLE.test(game.name ?? "");
}

function isRelease(game) {
  return RELEASE_TYPES.has(game.game_type ?? game.category ?? 0) && !game.version_parent;
}

// True when one of the game's release dates is its first release date, to the day.
function hasExactDate(game) {
  if (!game.first_release_date) return false;
  return (game.release_dates ?? []).some(
    (release) => release.date === game.first_release_date && (release.date_format ?? release.category) === EXACT_DATE,
  );
}

function isListable(game) {
  return !isAdult(game) && isRelease(game);
}

const toSeconds = (isoDate) => Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / 1000);
const quote = (text) => `"${text.replace(/["\\]/g, "")}"`;

async function listGames(params, env) {
  const from = params.get("from");
  const to = params.get("to");
  if (!DATE.test(from) || !DATE.test(to)) throw new RangeError("from and to must be YYYY-MM-DD");
  const page = Math.min(Number(params.get("page")) || 1, MAX_PAGE);
  const hype = params.get("sort") === "hype";

  const where = [
    `first_release_date >= ${toSeconds(from)}`,
    // "to" is the last day in range, so the range ends at the start of the next day.
    `first_release_date < ${toSeconds(to) + 86400}`,
    "cover != null",
  ];
  if (hype) where.push("hypes != null");
  if (ID.test(params.get("genre") ?? "")) where.push(`genres = (${params.get("genre")})`);
  if (ID.test(params.get("platform") ?? "")) where.push(`platforms = (${params.get("platform")})`);

  const games = await queryGames(
    `fields ${CARD_FIELDS.join(",")};
     where ${where.join(" & ")};
     sort ${hype ? "hypes desc" : "first_release_date asc"};
     limit ${PAGE_SIZE}; offset ${(page - 1) * PAGE_SIZE};`,
    env,
  );
  return {
    results: games.filter((game) => isListable(game) && hasExactDate(game)),
    hasMore: games.length === PAGE_SIZE && page < MAX_PAGE,
  };
}

async function searchGames(params, env) {
  const text = (params.get("q") ?? "").trim().slice(0, 80);
  if (!text) return { results: [], hasMore: false };
  const page = Math.min(Number(params.get("page")) || 1, MAX_PAGE);
  const games = await queryGames(
    `search ${quote(text)};
     fields ${CARD_FIELDS.join(",")};
     limit ${PAGE_SIZE}; offset ${(page - 1) * PAGE_SIZE};`,
    env,
  );
  return { results: games.filter(isListable), hasMore: games.length === PAGE_SIZE && page < MAX_PAGE };
}

// A direct link to an adult game gets nothing back, so the page shows it as not found.
async function getGame(params, env) {
  const id = params.get("id");
  if (!ID.test(id ?? "")) throw new RangeError("id must be a number");
  const [game] = await queryGames(`fields ${DETAIL_FIELDS.join(",")}; where id = ${id};`, env);
  if (!game || isAdult(game)) return { game: null };
  return { game: { ...game, similar_games: (game.similar_games ?? []).filter(isListable) } };
}

const ROUTES = {
  "/games": { answer: listGames, maxAge: LIST_CACHE_SECONDS },
  "/search": { answer: searchGames, maxAge: LIST_CACHE_SECONDS },
  "/game": { answer: getGame, maxAge: GAME_CACHE_SECONDS },
};

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export default {
  async fetch(request, env, context) {
    const origin = request.headers.get("Origin");
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      Vary: "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (!allowed || request.method !== "GET") return json({ error: "Not allowed" }, 403, cors);

    const url = new URL(request.url);
    const route = ROUTES[url.pathname];
    if (!route) return json({ error: "Not found" }, 404, cors);

    // Saved answers are shared by everyone, whichever allowed address asked.
    const cache = caches.default;
    const cacheKey = new Request(url.toString());
    const saved = await cache.match(cacheKey);
    if (saved) return json(await saved.json(), 200, cors);

    try {
      const body = await route.answer(url.searchParams, env);
      const fresh = json(body, 200, { "Cache-Control": `public, max-age=${route.maxAge}` });
      context.waitUntil(cache.put(cacheKey, fresh.clone()));
      return json(body, 200, { ...cors, "Cache-Control": `public, max-age=${route.maxAge}` });
    } catch (error) {
      const status = error instanceof RangeError ? 400 : 502;
      return json({ error: error.message }, status, cors);
    }
  },
};
