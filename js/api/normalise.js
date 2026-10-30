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

// The art's own colour, used to frame it (a game's wide key art sits inside a poster-shaped card).
// RAWG sends "0f0f0f", AniList "#e4a15d"; anything else is ignored.
function toTint(color) {
  const hex = color?.replace("#", "");
  return /^[0-9a-f]{6}$/i.test(hex ?? "") ? `#${hex}` : null;
}

export function normaliseRawgGame(game) {
  const date = game.released ?? null;
  return {
    source: "rawg",
    id: game.id,
    slug: game.slug ?? null,
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
    tint: toTint(game.dominant_color),
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
    cover: getTmdbImage(item.backdrop_path, "w1280"),
    season: null,
    platforms: [],
    genres: (item.genre_ids ?? []).map((id) => TMDB_GENRES[id]).filter(Boolean),
    rating:
      item.vote_average > 0 ? Math.round(item.vote_average * 5) / 10 : null,
  };
}

// AniList files manhwa (Korea) and manhua (China, Taiwan) as manga, so the country says which it is.
const MANGA_SUBTYPES = {
  KR: "Manhwa",
  CN: "Manhua",
  TW: "Manhua",
};

// Only a full date counts; AniList often knows just the year or month of an upcoming start.
function toAniListDate({ year, month, day } = {}) {
  if (!year || !month || !day) return null;
  return [year, month, day].map((part) => String(part).padStart(2, "0")).join("-");
}

// Descriptions come with <br> and <i> tags even as plain text, so the browser strips them.
function toPlainText(html) {
  if (!html) return "";
  const text = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, "\n"), "text/html").body.textContent;
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export function normaliseAniListMedia(media) {
  const type = media.type === "MANGA" ? "manga" : "anime";
  const date = toAniListDate(media.startDate);
  return {
    source: "anilist",
    id: media.id,
    type,
    subtype: type === "manga" ? MANGA_SUBTYPES[media.countryOfOrigin] ?? "Manga" : null,
    status: media.status ?? null,
    title: media.title?.english || media.title?.romaji || "Untitled",
    date,
    tba: !date,
    image: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    cover: media.bannerImage ?? media.coverImage?.extraLarge ?? null,
    season: null,
    platforms: [],
    genres: media.genres ?? [],
    rating: media.averageScore ? Math.round(media.averageScore / 2) / 10 : null,
    tint: toTint(media.coverImage?.color),
  };
}

export function normaliseAniListDetail(media) {
  return {
    ...normaliseAniListMedia(media),
    overview: toPlainText(media.description),
    episodes: media.episodes ?? null,
    chapters: media.chapters ?? null,
    volumes: media.volumes ?? null,
    nextEpisode: media.nextAiringEpisode
      ? { number: media.nextAiringEpisode.episode, at: media.nextAiringEpisode.airingAt * 1000 }
      : null,
    studios: (media.studios?.nodes ?? []).map((studio) => studio.name),
    trailerKey: media.trailer?.site === "youtube" ? media.trailer.id : null,
    // Official places to watch or read (Crunchyroll, Netflix, Webtoon, MANGA Plus and so on). AniList's
    // icons are white, made for coloured tiles, so they'd vanish in the light theme; names only.
    providers: (media.externalLinks ?? [])
      .filter((link) => link.type === "STREAMING")
      .map((link) => ({ name: link.site, logo: null, url: link.url })),
  };
}
