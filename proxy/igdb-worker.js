// Cloudflare Worker that looks up official game covers on IGDB for Drop Day.
// IGDB needs a secret key and blocks requests from browsers, so the site asks this Worker instead.
// Secrets (set in the Cloudflare dashboard, never in this file): TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET.
//
// GET /covers?slugs=grand-theft-auto-vi,hades-ii  ->  { "grand-theft-auto-vi": "co9abc", "hades-ii": null }

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

async function findCovers(slugs, env, retry = true) {
  const response = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${await getToken(env)}`,
      Accept: "application/json",
    },
    body: `fields slug, cover.image_id; where slug = (${slugs.map((slug) => `"${slug}"`).join(",")}); limit ${MAX_SLUGS};`,
  });
  // A revoked token gets one fresh try.
  if (response.status === 401 && retry) {
    token = null;
    return findCovers(slugs, env, false);
  }
  if (!response.ok) throw new Error(`IGDB failed: ${response.status}`);
  return response.json();
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

    const slugs = [...new Set((url.searchParams.get("slugs") ?? "").split(","))]
      .filter((slug) => SLUG.test(slug))
      .slice(0, MAX_SLUGS);
    if (!slugs.length) return json({}, 200, cors);

    try {
      const games = await findCovers(slugs, env);
      const covers = Object.fromEntries(slugs.map((slug) => [slug, null]));
      games.forEach((game) => {
        if (game.cover?.image_id) covers[game.slug] = game.cover.image_id;
      });
      return json(covers, 200, cors);
    } catch (error) {
      return json({ error: error.message }, 502, cors);
    }
  },
};
