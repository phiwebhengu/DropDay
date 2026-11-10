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

export function getTmdbImage(path, size = "w342") {
  return path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : null;
}

// The art's own colour, used to frame it. AniList sends "#e4a15d"; anything else is ignored.
function toTint(color) {
  const hex = color?.replace("#", "");
  return /^[0-9a-f]{6}$/i.test(hex ?? "") ? `#${hex}` : null;
}

const IGDB_IMAGE_BASE = "https://images.igdb.com/igdb/image/upload";

export function getIgdbImage(imageId, size) {
  return imageId ? `${IGDB_IMAGE_BASE}/t_${size}/${imageId}.jpg` : null;
}

// IGDB's names, shortened to what players call them (and what the Log modal and card stubs expect).
const IGDB_PLATFORM_NAMES = {
  "PC (Microsoft Windows)": "PC",
  "Xbox Series X|S": "Xbox Series S/X",
  Mac: "macOS",
  "PlayStation VR2": "PS VR2",
};

const IGDB_GENRE_NAMES = {
  "Role-playing (RPG)": "RPG",
  "Real Time Strategy (RTS)": "Strategy",
  "Turn-based strategy (TBS)": "Strategy",
  "Hack and slash/Beat 'em up": "Hack and slash",
  "Point-and-click": "Point and click",
  "Card & Board Game": "Card and board",
};

// The release date only counts when IGDB knows the day; "2026" alone is stored as 31 December.
function getExactDate(game) {
  const exact = (game.release_dates ?? []).some(
    (release) => release.date === game.first_release_date && (release.date_format ?? release.category) === 0,
  );
  return exact ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10) : null;
}

export function normaliseIgdbGame(game) {
  const date = getExactDate(game);
  // Wide art for the backdrop: a piece of key art when IGDB has one, otherwise a screenshot.
  const wideArt = game.artworks?.[0]?.image_id ?? game.screenshots?.[0]?.image_id;
  const genres = [...new Set((game.genres ?? []).map(({ name }) => IGDB_GENRE_NAMES[name] ?? name))];
  return {
    source: "igdb",
    id: game.id,
    slug: game.slug ?? null,
    type: "game",
    title: game.name || "Untitled",
    date,
    tba: !date,
    poster: getIgdbImage(game.cover?.image_id, "cover_big_2x"),
    image: getIgdbImage(wideArt, "screenshot_big"),
    cover: getIgdbImage(wideArt, "1080p"),
    // The same art in two widths, so phones download the smaller one.
    coverSrcset: wideArt
      ? `${getIgdbImage(wideArt, "screenshot_big")} 889w, ${getIgdbImage(wideArt, "1080p")} 1920w`
      : null,
    season: null,
    platforms: (game.platforms ?? []).map(({ name }) => IGDB_PLATFORM_NAMES[name] ?? name),
    platformIds: (game.platforms ?? []).map(({ id }) => id),
    genres,
    genreIds: (game.genres ?? []).map(({ id }) => id),
    // IGDB rates out of 100.
    rating: game.total_rating > 0 ? Math.round(game.total_rating / 2) / 10 : null,
    hypes: game.hypes ?? 0,
  };
}

export function normaliseIgdbGameDetail(game) {
  const companies = game.involved_companies ?? [];
  const trailer = (game.videos ?? []).find((video) => /trailer/i.test(video.name ?? "")) ?? game.videos?.[0];
  return {
    ...normaliseIgdbGame(game),
    description: [game.summary, game.storyline].filter(Boolean).join("\n\n"),
    developers: companies.filter((company) => company.developer).map(({ company }) => company.name),
    publishers: companies.filter((company) => company.publisher).map(({ company }) => company.name),
    screenshots: (game.screenshots ?? []).map(({ image_id }) => getIgdbImage(image_id, "screenshot_big")),
    // Full size, for opening a screenshot bigger.
    screenshotsLarge: (game.screenshots ?? []).map(({ image_id }) => getIgdbImage(image_id, "1080p")),
    trailerKey: trailer?.video_id ?? null,
    editions: [...(game.expansions ?? []), ...(game.dlcs ?? [])].map(({ name }) => name),
    similar: (game.similar_games ?? []).map(normaliseIgdbGame),
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
    coverSrcset: item.backdrop_path
      ? `${getTmdbImage(item.backdrop_path, "w780")} 780w, ${getTmdbImage(item.backdrop_path, "w1280")} 1280w`
      : null,
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
    recommendations: (media.recommendations?.nodes ?? [])
      .map((node) => node.mediaRecommendation)
      .filter((item) => item && !item.isAdult)
      .map(normaliseAniListMedia),
  };
}
