import { CACHE_TTL, STORAGE_KEYS } from "../config.js";

function toCacheKey(url) {
  const cleanUrl = new URL(url);
  cleanUrl.searchParams.delete("key");
  return STORAGE_KEYS.cachePrefix + cleanUrl.toString();
}

function readEntry(storage, cacheKey) {
  try {
    const entry = JSON.parse(storage.getItem(cacheKey));
    return entry?.savedAt ? entry : null;
  } catch {
    return null;
  }
}

function clearCache(storage) {
  Object.keys(storage)
    .filter((key) => key.startsWith(STORAGE_KEYS.cachePrefix))
    .forEach((key) => storage.removeItem(key));
}

function writeEntry(storage, cacheKey, data) {
  const entry = JSON.stringify({ savedAt: Date.now(), data });
  try {
    storage.setItem(cacheKey, entry);
  } catch {
    clearCache(storage);
    try {
      storage.setItem(cacheKey, entry);
    } catch {}
  }
}

// body turns the request into a POST (AniList's GraphQL API only takes POST); it's part of the cache key,
// since every AniList query goes to the same URL.
export async function cachedFetch(
  url,
  { headers = {}, body, maxAge = CACHE_TTL, persist = false } = {},
) {
  // persist keeps the response across visits (localStorage) instead of just this tab.
  const storage = persist ? localStorage : sessionStorage;
  const cacheKey = toCacheKey(url) + (body ? `#${body}` : "");
  const cached = readEntry(storage, cacheKey);

  if (cached && Date.now() - cached.savedAt < maxAge) {
    return { data: cached.data, savedAt: cached.savedAt, isStale: false };
  }

  try {
    const response = await fetch(
      url,
      body ? { method: "POST", headers, body } : { headers },
    );
    if (!response.ok) {
      throw new ApiError(
        response.status,
        `Request failed with status ${response.status}`,
      );
    }
    const data = await response.json();
    writeEntry(storage, cacheKey, data);
    return { data, savedAt: Date.now(), isStale: false };
  } catch (error) {
    if (cached && error.status !== 404) {
      return { data: cached.data, savedAt: cached.savedAt, isStale: true };
    }
    throw error;
  }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
