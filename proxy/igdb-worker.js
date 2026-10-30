// Cloudflare Worker that looks up official game covers on IGDB for Drop Day.
// IGDB needs a secret key and blocks requests from browsers, so the site asks this Worker instead.
// Secrets (set in the Cloudflare dashboard, never in this file): TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET.
//
// GET /covers?slugs=grand-theft-auto-vi,hades-ii  ->  { "grand-theft-auto-vi": "co9abc", "hades-ii": null }
// Optional names (pipe-separated) and years (comma-separated), in the same order as slugs: RAWG and IGDB
// don't always agree on a slug ("god-of-war-2" vs "god-of-war--1"), so a missed slug is tried by name.

const ALLOWED_ORIGINS = [
  "https://phiwebhengu.github.io",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
];
const SLUG = /^[a-z0-9-]{1,120}$/;
const MAX_SLUGS = 50;

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
  if (!response.ok) throw new Error(`IGDB failed: ${response.status}`);
  return response.json();
}

// "God of War (2018)" on RAWG is plain "God of War" on IGDB.
function cleanName(name) {
  return name.replace(/[™®]/g, "").replace(/\s*\(\d{4}\)$/, "").replace(/\s+/g, " ").trim();
}

const quote = (text) => `"${text.replace(/["\\]/g, "")}"`;
const yearOf = (seconds) => (seconds ? new Date(seconds * 1000).getUTCFullYear() : null);

function findBySlug(slugs, env) {
  return queryGames(
    `fields slug, cover.image_id; where slug = (${slugs.map(quote).join(",")}); limit ${MAX_SLUGS};`,
    env,
  );
}

// Several games can share a name (God of War 2005 and 2018), so the one released in RAWG's year wins.
async function findByName(wanted, env) {
  const names = wanted.map(({ name }) => `name ~ ${quote(name)}`).join(" | ");
  const games = await queryGames(
    `fields name, first_release_date, cover.image_id; where cover != null & (${names}); limit 500;`,
    env,
  );
  return Object.fromEntries(
    wanted.map(({ slug, name, year }) => {
      const matches = games.filter((game) => game.name.toLowerCase() === name.toLowerCase());
      const best = matches.find((game) => yearOf(game.first_release_date) === year) ?? (matches.length === 1 ? matches[0] : null);
      return [slug, best?.cover.image_id ?? null];
    }),
  );
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400", ...cors },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      Vary: "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    // Only Drop Day may use it, and only to look up covers, so it can't be used as an open proxy.
    if (!allowed || request.method !== "GET") return json({ error: "Not allowed" }, 403, cors);

    const url = new URL(request.url);
    if (url.pathname !== "/covers") return json({ error: "Not found" }, 404, cors);

    const names = (url.searchParams.get("names") ?? "").split("|");
    const years = (url.searchParams.get("years") ?? "").split(",");
    const requested = (url.searchParams.get("slugs") ?? "").split(",").map((slug, index) => ({
      slug,
      name: cleanName(names[index] ?? "").slice(0, 120),
      year: Number(years[index]) || null,
    }));
    const wanted = [...new Map(requested.filter(({ slug }) => SLUG.test(slug)).map((game) => [game.slug, game])).values()]
      .slice(0, MAX_SLUGS);
    if (!wanted.length) return json({}, 200, cors);

    try {
      const covers = Object.fromEntries(wanted.map(({ slug }) => [slug, null]));
      const games = await findBySlug(wanted.map(({ slug }) => slug), env);
      games.forEach((game) => {
        if (game.cover?.image_id) covers[game.slug] = game.cover.image_id;
      });

      const missed = wanted.filter(({ slug, name }) => !covers[slug] && name);
      if (missed.length) Object.assign(covers, await findByName(missed, env));
      return json(covers, 200, cors);
    } catch (error) {
      return json({ error: error.message }, 502, cors);
    }
  },
};
