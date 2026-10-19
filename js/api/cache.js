import { CACHE_TTL, STORAGE_KEYS } from "../config.js";

function toCacheKey(url) {
  const cleanUrl = new URL(url);
  cleanUrl.searchParams.delete("key");
  return STORAGE_KEYS.cachePrefix + cleanUrl.toString();
}

function readEntry(cacheKey) {
  try {
    const entry = JSON.parse(sessionStorage.getItem(cacheKey));
    return entry?.savedAt ? entry : null;
  } catch {
    return null;
  }
}

function clearCache() {
  Object.keys(sessionStorage)
    .filter((key) => key.startsWith(STORAGE_KEYS.cachePrefix))
    .forEach((key) => sessionStorage.removeItem(key));
}

function writeEntry(cacheKey, data) {
  const entry = JSON.stringify({ savedAt: Date.now(), data });
  try {
    sessionStorage.setItem(cacheKey, entry);
  } catch {
    clearCache();
    try {
      sessionStorage.setItem(cacheKey, entry);
    } catch {}
  }
}

export async function cachedFetch(
  url,
  { headers = {}, maxAge = CACHE_TTL } = {},
) {
  const cacheKey = toCacheKey(url);
  const cached = readEntry(cacheKey);

  if (cached && Date.now() - cached.savedAt < maxAge) {
    return { data: cached.data, savedAt: cached.savedAt, isStale: false };
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new ApiError(
        response.status,
        `Request failed with status ${response.status}`,
      );
    }
    const data = await response.json();
    writeEntry(cacheKey, data);
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
