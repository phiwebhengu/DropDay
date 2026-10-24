import { TMDB_IMAGE_BASE_URL } from "../config.js";

const TMDB_GENRES = {
  12: "Adventure",
  14: "Fantasy",
  16: "Animation",
  18: "Drama",
  27: "Horror",
  28: "Action",
  35: "Comedy",
  36: "History",
  37: "Western",
  53: "Thriller",
  80: "Crime",
  99: "Documentary",
  878: "Science Fiction",
  9648: "Mystery",
  10402: "Music",
  10749: "Romance",
  10751: "Family",
  10752: "War",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
  10770: "TV Movie",
};

export function resizeRawgImage(url) {
  if (!url) return null;
  return url
    .replace("/media/games/", "/media/crop/600/400/games/")
    .replace("/media/screenshots/", "/media/crop/600/400/screenshots/");
}

export function getTmdbImage(path, size = "w342") {
  return path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : null;
}

// Game detail and the Home hero show the art large, so it gets a bigger, uncropped copy than the cards.
function resizeRawgCover(url) {
  return url ? url.replace("/media/games/", "/media/resize/1280/-/games/") : null;
}

export function normaliseRawgGame(game) {
  const date = game.released ?? null;
  return {
    source: "rawg",
    id: game.id,
    type: "game",
    title: game.name || "Untitled",
    date,
    tba: Boolean(game.tba) || !date,
    image: resizeRawgImage(game.background_image),
    cover: resizeRawgCover(game.background_image),
    season: null,
    platforms: (game.platforms ?? []).map(({ platform }) => platform.name),
    genres: (game.genres ?? []).map((genre) => genre.name),
    rating: game.rating > 0 ? game.rating : null,
  };
}

export function normaliseRawgGameDetail(game) {
  return {
    ...normaliseRawgGame(game),
    description: game.description_raw ?? "",
    developers: (game.developers ?? []).map((developer) => developer.name),
    publishers: (game.publishers ?? []).map((publisher) => publisher.name),
    platformIds: (game.platforms ?? []).map(({ platform }) => platform.id),
    genreIds: (game.genres ?? []).map((genre) => genre.id),
  };
}

export function normaliseTmdbItem(item, type) {
  const date = item.release_date || item.first_air_date || null;
  return {
    source: "tmdb",
    id: item.id,
    type,
    title: item.title || item.name || "Untitled",
    date,
    tba: !date,
    image: getTmdbImage(item.poster_path),
    season: null,
    platforms: [],
    genres: (item.genre_ids ?? []).map((id) => TMDB_GENRES[id]).filter(Boolean),
    rating:
      item.vote_average > 0 ? Math.round(item.vote_average * 5) / 10 : null,
  };
}
