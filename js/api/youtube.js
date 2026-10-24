import { TRAILER_CACHE_TTL, YOUTUBE_API_KEY, YOUTUBE_BASE_URL } from "../config.js";
import { cachedFetch } from "./cache.js";

// Finds the most relevant embeddable trailer for a title. Resolves to null without a key or a match.
export async function findTrailer(title) {
  if (!YOUTUBE_API_KEY) return null;
  const url = new URL(`${YOUTUBE_BASE_URL}/search`);
  url.search = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    maxResults: "1",
    q: `${title} official trailer`,
    key: YOUTUBE_API_KEY,
  });
  const { data } = await cachedFetch(url.toString(), { maxAge: TRAILER_CACHE_TTL, persist: true });
  const youtubeId = data.items?.[0]?.id?.videoId;
  return youtubeId ? { youtubeId } : null;
}
