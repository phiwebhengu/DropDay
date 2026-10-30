import * as anilist from '../api/anilist.js';
import * as rawg from '../api/rawg.js';
import * as tmdb from '../api/tmdb.js';
import * as youtube from '../api/youtube.js';
import { getEntry, listByStatus } from '../store/library.js';
import { createReleaseCard, createCardSkeleton, getDateText, getSaveText } from '../ui/card.js';
import { syncCards, toggleSave } from '../ui/library-actions.js';
import { openQuickView } from '../ui/quick-view.js';
import { createShelfItem, setupShelf, updateShelfArrows } from '../ui/shelf.js';
import { canPreview, createBillboardPreview } from '../ui/hero-trailer.js';
import { openTrailerDialog } from '../ui/trailer-dialog.js';
import { createStateMessage } from '../ui/states.js';
import { playHeroIntro, swapBillboard, tickDigit } from '../motion.js';
import { getMonthRange, toMonthKey } from '../utils/dates.js';
import { getTypeLabel } from '../utils/media.js';
import '../ui/save-feedback.js';
import '../ui/theme.js';

const SKELETON_DELAY = 150;
const SKELETON_COUNT = 6;
const PER_CATEGORY = 3;
const SHELF_SIZE = 12;
const UP_NEXT_SIZE = 12;
const SLIDE_TIME = 8000;
const MAX_PLATFORMS = 3;

const PLATFORM_NAMES = {
  'Xbox Series S/X': 'Xbox Series X|S',
  'PlayStation 5': 'PS5',
  'PlayStation 4': 'PS4',
  'Nintendo Switch': 'Switch',
};

const hero = document.getElementById('hero');
const heroArt = document.getElementById('hero-art');
const heroGlowLights = [...document.querySelectorAll('.billboard-stage__light')];
const heroSlide = document.getElementById('hero-slide');
const heroEyebrow = document.getElementById('hero-eyebrow');
const heroTitle = document.getElementById('hero-title');
const heroMeta = document.getElementById('hero-meta');
const heroSave = document.getElementById('hero-save');
const heroDetails = document.getElementById('hero-details');
const heroTrailer = document.getElementById('hero-trailer');
const heroSound = document.getElementById('hero-sound');
const heroControls = document.getElementById('hero-controls');
const heroDots = document.getElementById('hero-dots');
const heroPause = document.getElementById('hero-pause');
const countdown = document.getElementById('countdown');
const countdownValues = Object.fromEntries(
  [...countdown.querySelectorAll('[data-unit]')].map((element) => [element.dataset.unit, element]),
);
const home = document.querySelector('.home');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let slides = [];
let current = -1;
let featured = null;
let countdownTimer;
let countdownStarted = false;
let slideTimer;
let paused = reducedMotion.matches;
let holding = false;

/* Billboard: a few featured releases in turn, like the top of Apple TV */

function getReleaseTime({ date }) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function tick() {
  const remaining = getReleaseTime(featured) - Date.now();
  if (remaining <= 0) {
    clearInterval(countdownTimer);
    countdown.hidden = true;
    return;
  }
  const seconds = Math.floor(remaining / 1000);
  const next = {
    days: pad(Math.floor(seconds / 86400)),
    hours: pad(Math.floor((seconds % 86400) / 3600)),
    minutes: pad(Math.floor((seconds % 3600) / 60)),
    seconds: pad(seconds % 60),
  };
  // Only the units that changed animate, so most seconds it's just the last box ticking.
  Object.entries(next).forEach(([unit, value]) => {
    const element = countdownValues[unit];
    const previous = element.textContent;
    if (previous === value) return;
    element.textContent = value;
    if (countdownStarted) tickDigit(element, previous);
  });
  countdownStarted = true;
}

function startCountdown(release) {
  clearInterval(countdownTimer);
  countdownStarted = false;
  countdown.hidden = release.tba || !release.date || getReleaseTime(release) <= Date.now();
  if (countdown.hidden) return;
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function renderHeroSave() {
  const entry = getEntry(featured);
  heroSave.disabled = false;
  heroSave.setAttribute('aria-pressed', String(Boolean(entry)));
  heroSave.textContent = getSaveText(featured, entry);
}

function getMeta(release) {
  const details = [getDateText(release)];
  if (release.type === 'game') {
    details.push(release.platforms.slice(0, MAX_PLATFORMS).map((name) => PLATFORM_NAMES[name] ?? name).join(' · '));
  } else if (release.genres?.length) {
    details.push(release.genres.slice(0, 2).join(' · '));
  }
  return details.filter(Boolean).join('  ·  ');
}

// A film or show's own logo when TMDB has one, otherwise the title in display type.
function renderTitleContent(release, logo) {
  if (!logo) return release.title;
  const image = document.createElement('img');
  image.className = 'hero__logo';
  image.src = logo;
  image.alt = release.title;
  return image;
}

function renderTitle(release, logo) {
  const content = renderTitleContent(release, logo);
  if (release.type === 'game') {
    const link = document.createElement('a');
    link.className = 'hero__link';
    link.href = `game.html?id=${release.id}`;
    link.append(content);
    return link;
  }
  const button = document.createElement('button');
  button.className = 'hero__link billboard__title-button';
  button.type = 'button';
  button.append(content);
  button.addEventListener('click', () => openQuickView(release, button));
  return button;
}

const ART_WAIT = 1500;

// The screen lights the page: two layers take turns, so the glow cross-fades to the new slide's art.
let glowIndex = 0;
function lightPage(art) {
  if (!art) return;
  const [current, next] = glowIndex === 0 ? heroGlowLights : [...heroGlowLights].reverse();
  next.style.setProperty('--glow-art', `url("${art.replaceAll('"', '%22')}")`);
  next.classList.add('is-active');
  current.classList.remove('is-active');
  glowIndex = 1 - glowIndex;
}
const CATEGORY_NAMES = { game: 'games', movie: 'movies' };

// Every slide's art is built (and starts downloading) as soon as the billboard loads, stacked under the
// trailer. A slide only switches once its picture is ready, so the title and art always change together.
function createArt() {
  heroArt.classList.remove('skeleton');
  slides.forEach((slide, index) => {
    const image = document.createElement('img');
    image.className = 'hero__image';
    image.alt = '';
    image.decoding = 'async';
    if (index > 0) image.fetchPriority = 'low';
    image.src = slide.release.cover;
    slide.image = image;
    slide.ready = Promise.all([image.decode().catch(() => image.remove()), loadLogo(slide)]);
    heroArt.prepend(image);
  });
}

// Films and shows: the logo is fetched and decoded with the art, so the title never swaps from text to
// logo in front of anyone. If it isn't ready in time, the slide keeps its text title.
async function loadLogo(slide) {
  const { release } = slide;
  if (release.source !== 'tmdb' || !['movie', 'tv'].includes(release.type)) return;
  try {
    const details = release.type === 'movie' ? await tmdb.getMovie(release.id) : await tmdb.getShow(release.id, 'tv');
    if (!details.logo) return;
    const image = new Image();
    image.src = details.logo;
    await image.decode();
    slide.logo = details.logo;
  } catch {
    // No logo: the text title is used.
  }
}

// Waits for the art, but never longer than ART_WAIT: on a slow connection the text goes ahead.
function whenReady(slide) {
  return Promise.race([slide.ready, new Promise((resolve) => setTimeout(resolve, ART_WAIT))]);
}

function renderDots() {
  heroDots.replaceChildren(
    ...slides.map(({ release }, index) => {
      const dot = document.createElement('button');
      dot.className = 'billboard__dot';
      dot.type = 'button';
      dot.setAttribute('aria-label', `Show ${release.title}`);
      dot.addEventListener('click', () => showSlide(index));
      return dot;
    }),
  );
  // The sound button lives in the same group, so only the slide controls hide for a single release.
  heroControls.hidden = false;
  heroDots.hidden = slides.length < 2;
  heroPause.hidden = slides.length < 2;
}

let switchId = 0;

async function showSlide(index) {
  if (index === current) return;
  const id = ++switchId;
  await whenReady(slides[index]);
  // A newer choice (a quick second dot click) wins.
  if (id !== switchId) return;

  const first = current === -1;
  const previous = slides[current];
  current = index;
  const { release, label, image, logo } = slides[index];
  featured = release;

  const category = `var(--color-category-${CATEGORY_NAMES[release.type] ?? release.type})`;
  heroEyebrow.textContent = `${label} · ${getTypeLabel(release)}`;
  heroEyebrow.style.setProperty('--eyebrow-accent', category);
  lightPage(release.cover);
  heroTitle.replaceChildren(renderTitle(release, logo));
  heroTitle.classList.toggle('hero__title--logo', Boolean(logo));
  heroMeta.textContent = getMeta(release);
  heroDetails.href = release.type === 'game' ? `game.html?id=${release.id}` : `discover.html?cat=${CATEGORY_NAMES[release.type] ?? release.type}`;
  renderHeroSave();
  startCountdown(release);

  previous?.image.classList.remove('is-active');
  image.classList.add('is-active');
  [...heroDots.children].forEach((dot, dotIndex) => {
    dot.setAttribute('aria-current', String(dotIndex === index));
  });

  if (first) playHeroIntro(hero);
  else swapBillboard(image, heroSlide);
  startSlideTrailer(index);
}

/* Trailers: every slide plays its own preview, then the billboard moves on (Netflix, Apple TV) */

const trailers = new Map();

// Games: YouTube finds the official trailer (RAWG only has clips for games on Steam). Films and shows
// come from TMDB, anime from AniList. Each is looked up once per visit.
function findTrailer(release) {
  const key = `${release.source}:${release.type}:${release.id}`;
  if (!trailers.has(key)) {
    const lookup = {
      game: async () => (await youtube.findTrailer(release.title).catch(() => null)) ?? rawg.getTrailer(release.id),
      movie: async () => (await tmdb.getMovie(release.id)).trailerKey,
      tv: async () => (await tmdb.getShow(release.id, 'tv')).trailerKey,
      anime: async () => (await anilist.getMedia(release.id))?.trailerKey,
    }[release.type];
    const found = (lookup?.() ?? Promise.resolve(null))
      .then((result) => (typeof result === 'string' ? { youtubeId: result } : result ?? null))
      .catch(() => null);
    trailers.set(key, found);
  }
  return trailers.get(key);
}

const preview = createBillboardPreview({
  hero,
  media: heroArt,
  soundButton: heroSound,
  onFinish: () => queueAdvance(0),
});

function nextIndex() {
  return (current + 1) % slides.length;
}

// Moves on after delay, unless paused, hidden or someone is reading the billboard (pointer or focus in it).
function queueAdvance(delay = SLIDE_TIME) {
  clearTimeout(slideTimer);
  if (paused || slides.length < 2) return;
  slideTimer = setTimeout(() => {
    if (document.hidden || holding) queueAdvance(2000);
    else showSlide(nextIndex());
  }, delay);
}

// A slide with a trailer moves on when its preview ends; one without, after SLIDE_TIME.
async function startSlideTrailer(index) {
  clearTimeout(slideTimer);
  preview.stop();
  heroTrailer.hidden = true;
  const trailer = await findTrailer(slides[index].release);
  if (index !== current) return;
  slides[index].trailer = trailer;
  heroTrailer.hidden = !trailer;
  if (trailer && !paused && !document.hidden && canPreview()) preview.play(trailer, slides[index].release.title);
  else queueAdvance();
}

function renderPause() {
  heroPause.setAttribute('aria-pressed', String(paused));
  heroPause.setAttribute('aria-label', paused ? 'Play the featured releases' : 'Pause the featured releases');
}

function renderHeroMessage(message) {
  hero.setAttribute('aria-busy', 'false');
  hero.classList.add('hero--message');
  heroEyebrow.textContent = 'Featured';
  heroTitle.textContent = 'Drop Day';
  heroMeta.textContent = '';
  heroArt.hidden = true;
  countdown.hidden = true;
  heroSave.hidden = true;
  heroMeta.after(message);
}

// The featured game leads (it has the trailer and countdown), then the best of what's in cinemas,
// airing and coming soon, as long as there's wide art to show.
function pickSlides({ anticipated, cinema, airing }) {
  const candidates = [
    [anticipated[0], 'Most anticipated'],
    [cinema[0], 'In cinemas now'],
    [airing[0], 'Airing now'],
    [anticipated[1], 'Most anticipated'],
    [cinema[1], 'In cinemas now'],
  ];
  return candidates.filter(([release]) => release?.cover).map(([release, label]) => ({ release, label }));
}

function loadBillboard(sources) {
  Promise.allSettled([sources.anticipated, sources.cinema, sources.airing]).then(([anticipated, cinema, airing]) => {
    const results = (result) => (result.status === 'fulfilled' ? result.value.results : []);
    slides = pickSlides({ anticipated: results(anticipated), cinema: results(cinema), airing: results(airing) });
    hero.setAttribute('aria-busy', 'false');

    if (!slides.length) {
      const failed = [anticipated, cinema, airing].every((result) => result.status === 'rejected');
      renderHeroMessage(
        createStateMessage(
          failed
            ? { type: 'error', title: "Featured releases couldn't load", text: 'Check your connection, then try again.', actionLabel: 'Retry', onAction: () => location.reload() }
            : { type: 'empty', title: 'No big launches in the next 90 days', text: 'Browse everything dropping soon instead.' },
        ),
      );
      return;
    }

    createArt();
    renderDots();
    renderPause();
    showSlide(0);
  });
}

/* Shelves */

function getShelf(key) {
  const section = document.getElementById(`${key}-shelf`);
  return {
    section,
    track: section.querySelector('.shelf__track'),
    state: section.querySelector('.shelf__state'),
    empty: section.querySelector('.shelf__empty'),
  };
}

function fillShelf(key, releases, { ranked = false } = {}) {
  const { section, track } = getShelf(key);
  track.setAttribute('aria-busy', 'false');
  track.replaceChildren(
    ...releases.map((release, index) =>
      createShelfItem(createReleaseCard(release, { entry: getEntry(release) }), ranked ? index + 1 : null),
    ),
  );
  updateShelfArrows(section);
}

// Every shelf loads on its own, so one slow or failing source never holds up the rest (PRD states).
async function loadShelf(key, load, { ranked = false, emptyTitle, emptyText } = {}) {
  const { section, track, state } = getShelf(key);
  state.hidden = true;
  track.hidden = false;
  const skeletonTimer = setTimeout(() => {
    track.replaceChildren(...Array.from({ length: SKELETON_COUNT }, () => createShelfItem(createCardSkeleton())));
  }, SKELETON_DELAY);

  try {
    const releases = (await load()).slice(0, ranked ? 10 : SHELF_SIZE);
    clearTimeout(skeletonTimer);
    if (!releases.length) {
      track.hidden = true;
      state.replaceChildren(createStateMessage({ type: 'empty', title: emptyTitle, text: emptyText }));
      state.hidden = false;
      return;
    }
    fillShelf(key, releases, { ranked });
  } catch {
    clearTimeout(skeletonTimer);
    track.hidden = true;
    track.setAttribute('aria-busy', 'false');
    state.replaceChildren(
      createStateMessage({
        type: 'error',
        title: `${section.querySelector('.shelf__title').textContent} couldn't load`,
        text: 'Check your connection, then try again.',
        actionLabel: 'Retry',
        onAction: () => loadShelf(key, load, { ranked, emptyTitle, emptyText }),
      }),
    );
    state.hidden = false;
  }
}

// Takes one from each category in turn, so the shelf shows the mix instead of a block of games.
function interleave(lists) {
  const mixed = [];
  for (let index = 0; index < PER_CATEGORY; index += 1) {
    lists.forEach((list) => {
      if (list[index]) mixed.push(list[index]);
    });
  }
  return mixed;
}

async function loadMonth() {
  const range = getMonthRange(toMonthKey(new Date()));
  // One category failing shouldn't empty the whole shelf.
  const results = await Promise.allSettled([
    rawg.getGames({ ...range, ordering: '-added' }),
    tmdb.getMovies(range),
    tmdb.getShows(range),
    anilist.getAnime(range),
  ]);
  if (results.every((result) => result.status === 'rejected')) throw new Error('Nothing loaded');
  return interleave(results.map((result) => (result.status === 'fulfilled' ? result.value.results : [])));
}

/* Up next from your list: localStorage only, so it renders even offline */

function renderUpNext() {
  const { track, empty } = getShelf('up-next');
  const entries = listByStatus('want').slice(0, UP_NEXT_SIZE);
  empty.hidden = entries.length > 0;
  track.hidden = entries.length === 0;
  if (entries.length) fillShelf('up-next', entries);
  else track.setAttribute('aria-busy', 'false');
}

/* Events */

hero.addEventListener('pointerenter', () => {
  holding = true;
});
hero.addEventListener('pointerleave', () => {
  holding = false;
});
hero.addEventListener('focusin', () => {
  holding = true;
});
hero.addEventListener('focusout', (event) => {
  if (!hero.contains(event.relatedTarget)) holding = false;
});

// Pausing stops the preview and holds the slide; playing again picks up where it is.
heroPause.addEventListener('click', () => {
  paused = !paused;
  renderPause();
  if (paused) {
    clearTimeout(slideTimer);
    preview.stop();
  } else {
    startSlideTrailer(current);
  }
});

heroTrailer.addEventListener('click', () => {
  const { release, trailer } = slides[current];
  preview.stop();
  queueAdvance();
  openTrailerDialog({ title: release.title, trailer }, heroTrailer);
});

// A hidden tab stops the preview; coming back starts this slide's again.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) preview.stop();
  else if (!paused && slides.length) startSlideTrailer(current);
});

heroSave.addEventListener('click', () => toggleSave(featured));

// Games have their own page; films, shows and anime open the Quick view, like their cards.
heroDetails.addEventListener('click', (event) => {
  if (featured?.type === 'game') return;
  event.preventDefault();
  openQuickView(featured, heroDetails);
});

home.addEventListener('release:save', (event) => toggleSave(event.detail.release));
home.addEventListener('release:quickview', (event) => {
  openQuickView(event.detail.release, event.target.querySelector('.release-card__link'));
});

window.addEventListener('library:change', () => {
  if (featured) renderHeroSave();
  syncCards(home);
  renderUpNext();
});

document.querySelectorAll('.shelf').forEach(setupShelf);

renderUpNext();

// The billboard and three shelves share their first request; a Retry asks again for real.
function shared(first, fresh) {
  let used = false;
  return () => {
    const request = used ? fresh() : first;
    used = true;
    return request.then((page) => page.results);
  };
}

const sources = {
  anticipated: rawg.getAnticipated(),
  cinema: tmdb.getNowPlaying(),
  airing: anilist.getAiringAnime(),
};
loadBillboard(sources);
loadShelf('month', loadMonth, { emptyTitle: 'Nothing dropping this month', emptyText: 'Look further ahead on Discover.' });
loadShelf('top', shared(sources.anticipated, () => rawg.getAnticipated()), {
  ranked: true,
  emptyTitle: 'No big launches coming up',
  emptyText: 'Check back soon.',
});
loadShelf('cinema', shared(sources.cinema, () => tmdb.getNowPlaying()), {
  emptyTitle: 'Nothing in cinemas right now',
  emptyText: 'See what opens this month on Discover.',
});
loadShelf('airing', shared(sources.airing, () => anilist.getAiringAnime()), {
  emptyTitle: 'Nothing airing right now',
  emptyText: 'Check back soon.',
});
loadShelf('manga', () => anilist.getManga().then((page) => page.results), {
  emptyTitle: 'No trending manga right now',
  emptyText: 'Check back soon.',
});
