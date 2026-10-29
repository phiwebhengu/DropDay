import { ANILIST_URL, LIST_CACHE_TTL, PAGE_SIZE } from "../config.js";
import { ApiError, cachedFetch } from "./cache.js";
import { normaliseAniListMedia, normaliseAniListDetail } from "./normalise.js";

// Anime counts as a release when a new series or film starts; manga when a new series starts.
// Music videos, OVAs and novels are left out so the lists stay about the shows and comics people follow.
const FORMATS = {
  ANIME: ["TV", "TV_SHORT", "MOVIE", "ONA"],
  MANGA: ["MANGA", "ONE_SHOT"],
};

const MEDIA_FIELDS = `
  id type format countryOfOrigin
  title { english romaji }
  startDate { year month day }
  coverImage { extraLarge large }
  bannerImage genres averageScore
`;

// isAdult: false is AniList's own adult flag, so explicit titles never reach the page.
const LIST_QUERY = `
  query ($page: Int, $perPage: Int, $type: MediaType, $formats: [MediaFormat], $from: FuzzyDateInt,
         $to: FuzzyDateInt, $genre: String, $search: String, $sort: [MediaSort]) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(type: $type, format_in: $formats, isAdult: false, startDate_greater: $from,
            startDate_lesser: $to, genre: $genre, search: $search, sort: $sort) { ${MEDIA_FIELDS} }
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

async function getPage(type, { start, end, genres, search, page = 1 }) {
  const variables = {
    page,
    perPage: PAGE_SIZE,
    type,
    formats: FORMATS[type],
    genre: genres || null,
    search: search || null,
    from: !search && start ? toFuzzyDate(start, -1) : null,
    to: !search && end ? toFuzzyDate(end, 1) : null,
    sort: search ? ["SEARCH_MATCH", "POPULARITY_DESC"] : ["START_DATE", "POPULARITY_DESC"],
  };
  const { data, savedAt, isStale } = await request(LIST_QUERY, variables);
  const { media, pageInfo } = data.Page;
  return {
    results: media.map(normaliseAniListMedia),
    // AniList's totals aren't reliable, so the count is only given once the last page is in.
    count: pageInfo.hasNextPage ? null : (page - 1) * PAGE_SIZE + media.length,
    page,
    hasMore: pageInfo.hasNextPage,
    savedAt,
    isStale,
  };
}

export function getAnime(options = {}) {
  return getPage("ANIME", options);
}

export function getManga(options = {}) {
  return getPage("MANGA", options);
}

export function searchAnime({ query, page = 1 }) {
  return getPage("ANIME", { search: query, page });
}

export function searchManga({ query, page = 1 }) {
  return getPage("MANGA", { search: query, page });
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
