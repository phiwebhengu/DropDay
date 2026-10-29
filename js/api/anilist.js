import { ANILIST_URL, LIST_CACHE_TTL, PAGE_SIZE } from "../config.js";
import { ApiError, cachedFetch } from "./cache.js";
import { normaliseAniListMedia, normaliseAniListDetail } from "./normalise.js";

// Anime counts as a release when a new series or film starts. Manga has no release dates worth listing
// (new chapters aren't scheduled on AniList), so its browse view is what's trending instead.
// Music videos, OVAs and novels are left out so the lists stay about the shows and comics people follow.
const FORMATS = {
  ANIME: ["TV", "TV_SHORT", "MOVIE", "ONA"],
  MANGA: ["MANGA", "ONE_SHOT"],
};

// Fewer followers than this is mostly unlicensed or very niche (checked against AniList's real lists).
const MIN_POPULARITY = 1000;

const MEDIA_FIELDS = `
  id type format status countryOfOrigin
  title { english romaji }
  startDate { year month day }
  coverImage { extraLarge large }
  bannerImage genres averageScore
`;

// isAdult: false is AniList's own adult flag, so explicit titles never reach the page.
const LIST_QUERY = `
  query ($page: Int, $perPage: Int, $type: MediaType, $formats: [MediaFormat], $from: FuzzyDateInt,
         $to: FuzzyDateInt, $genre: String, $search: String, $status: MediaStatus,
         $minPopularity: Int, $sort: [MediaSort]) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(type: $type, format_in: $formats, isAdult: false, startDate_greater: $from,
            startDate_lesser: $to, genre: $genre, search: $search, status: $status,
            popularity_greater: $minPopularity, sort: $sort) { ${MEDIA_FIELDS} }
    }
  }
`;

const DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id) {
      ${MEDIA_FIELDS}
      isAdult status description(asHtml: false) episodes chapters volumes
      nextAiringEpisode { airingAt episode }
      trailer { id site }
      studios(isMain: true) { nodes { name } }
      externalLinks { site url type }
    }
  }
`;

const GENRE_QUERY = "query { GenreCollection }";

// AniList answers errors inside the JSON as well as with a status, so both are checked.
async function request(query, variables = {}, options = {}) {
  const { data, savedAt, isStale } = await cachedFetch(ANILIST_URL, {
    ...options,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (data.errors?.length) {
    const [error] = data.errors;
    throw new ApiError(error.status ?? 500, error.message);
  }
  return { data: data.data, savedAt, isStale };
}

// AniList dates are numbers like 20261119, and its date filters leave out the end points.
function toFuzzyDate(isoDate, offset) {
  return Number(isoDate.replaceAll("-", "")) + offset;
}

const MIN_RESULTS = 12;
const MAX_PAGES = 3;

// A filter sent as null makes AniList reject the whole query, so unused ones are left out entirely
// (JSON drops undefined values). When keep filters some out, more pages are read until there's
// enough to fill the grid, the same way the TV list does.
async function getPage(type, filters, { page = 1, keep = () => true } = {}) {
  const results = [];
  let current = page;
  let hasMore = true;
  let filtered = false;
  let savedAt = Date.now();
  let isStale = false;

  while (results.length < MIN_RESULTS && hasMore && current < page + MAX_PAGES) {
    const variables = { page: current, perPage: PAGE_SIZE, type, formats: FORMATS[type], ...filters };
    const response = await request(LIST_QUERY, variables);
    const { media, pageInfo } = response.data.Page;
    const kept = media.filter(keep);
    filtered ||= kept.length !== media.length;
    results.push(...kept.map(normaliseAniListMedia));
    hasMore = pageInfo.hasNextPage;
    savedAt = Math.min(savedAt, response.savedAt);
    isStale ||= response.isStale;
    current += 1;
  }

  return {
    results,
    // AniList's totals aren't reliable, so a count is only given for a single, complete, unfiltered page.
    count: page === 1 && current === 2 && !hasMore && !filtered ? results.length : null,
    page: current - 1,
    hasMore,
    savedAt,
    isStale,
  };
}

// Many upcoming anime only have a year ("2027"), which AniList counts as inside any range ending
// that year, so only exact dates are listed.
function hasFullDate({ startDate }) {
  return Boolean(startDate?.year && startDate.month && startDate.day);
}

export function getAnime({ start, end, genres, page = 1 } = {}) {
  const filters = {
    from: toFuzzyDate(start, -1),
    to: toFuzzyDate(end, 1),
    genre: genres || undefined,
    minPopularity: MIN_POPULARITY,
    sort: ["START_DATE", "POPULARITY_DESC"],
  };
  return getPage("ANIME", filters, { page, keep: hasFullDate });
}

// Ongoing series, hottest first; the date range doesn't apply.
export function getManga({ genres, page = 1 } = {}) {
  const filters = { status: "RELEASING", genre: genres || undefined, sort: ["TRENDING_DESC", "POPULARITY_DESC"] };
  return getPage("MANGA", filters, { page });
}

function search(type, { query, page = 1 }) {
  return getPage(type, { search: query, sort: ["SEARCH_MATCH", "POPULARITY_DESC"] }, { page });
}

export function searchAnime(options) {
  return search("ANIME", options);
}

export function searchManga(options) {
  return search("MANGA", options);
}

// Genres are plain names on AniList, so each one is its own id.
export async function getGenres() {
  const { data } = await request(GENRE_QUERY, {}, { maxAge: LIST_CACHE_TTL });
  return data.GenreCollection.filter((genre) => genre !== "Hentai").map((name) => ({ id: name, name }));
}

// Resolves to null for an adult title, so a direct link shows nothing.
export async function getMedia(id) {
  const { data } = await request(DETAIL_QUERY, { id: Number(id) });
  return data.Media.isAdult ? null : normaliseAniListDetail(data.Media);
}
