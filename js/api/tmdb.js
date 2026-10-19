import {
  TMDB_BASE_URL,
  TMDB_READ_ACCESS_TOKEN,
  TMDB_REGION,
} from "../config.js";
import { cachedFetch } from "./cache.js";
import { getTmdbImage, normaliseTmdbItem } from "./normalise.js";

const ANIMATION_GENRE_ID = 16;

const headers = {
  Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`,
  accept: "application/json",
};

function buildUrl(path, params = {}) {
  const url = new URL(TMDB_BASE_URL + path);
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(name, value);
    }
  });
  return url.toString();
}

async function getPage(url, type, page) {
  const { data, savedAt, isStale } = await cachedFetch(url, { headers });
  return {
    results: data.results.map((item) => normaliseTmdbItem(item, type)),
    count: data.total_results,
    page,
    hasMore: page < data.total_pages,
    savedAt,
    isStale,
  };
}

export function getMovies({ start, end, genres, page = 1 } = {}) {
  const url = buildUrl("/discover/movie", {
    "primary_release_date.gte": start,
    "primary_release_date.lte": end,
    with_genres: genres,
    region: TMDB_REGION,
    sort_by: "popularity.desc",
    page,
  });
  return getPage(url, "movie", page);
}

export function getShows({ start, end, genres, page = 1 } = {}) {
  const url = buildUrl("/discover/tv", {
    "air_date.gte": start,
    "air_date.lte": end,
    with_genres: genres,
    without_genres: ANIMATION_GENRE_ID,
    sort_by: "popularity.desc",
    page,
  });
  return getPage(url, "tv", page);
}

export function getAnime({ start, end, page = 1 } = {}) {
  const url = buildUrl("/discover/tv", {
    "air_date.gte": start,
    "air_date.lte": end,
    with_genres: ANIMATION_GENRE_ID,
    with_origin_country: "JP",
    sort_by: "popularity.desc",
    page,
  });
  return getPage(url, "anime", page);
}

function toQuickView(data, type) {
  const providers = data["watch/providers"]?.results?.[TMDB_REGION];
  const trailer = data.videos?.results?.find(
    (video) => video.site === "YouTube" && video.type === "Trailer",
  );
  return {
    ...normaliseTmdbItem(
      { ...data, genre_ids: (data.genres ?? []).map((genre) => genre.id) },
      type,
    ),
    overview: data.overview ?? "",
    runtime: data.runtime ?? null,
    seasons: data.number_of_seasons ?? null,
    nextEpisodeDate: data.next_episode_to_air?.air_date ?? null,
    providers: (providers?.flatrate ?? []).map((provider) => ({
      name: provider.provider_name,
      logo: getTmdbImage(provider.logo_path, "w92"),
    })),
    trailerKey: trailer?.key ?? null,
  };
}

export async function getMovie(id) {
  const url = buildUrl(`/movie/${id}`, {
    append_to_response: "watch/providers,videos",
  });
  const { data } = await cachedFetch(url, { headers });
  return toQuickView(data, "movie");
}

export async function getShow(id, type = "tv") {
  const url = buildUrl(`/tv/${id}`, {
    append_to_response: "watch/providers,videos",
  });
  const { data } = await cachedFetch(url, { headers });
  return toQuickView(data, type);
}
