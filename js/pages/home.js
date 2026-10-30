import * as anilist from '../api/anilist.js';
import * as rawg from '../api/rawg.js';
import * as tmdb from '../api/tmdb.js';
import * as youtube from '../api/youtube.js';
import { getEntry, listByStatus } from '../store/library.js';
import { createReleaseCard, createCardSkeleton, getDateText, getSaveText } from '../ui/card.js';
import { syncCards, toggleSave } from '../ui/library-actions.js';
import { openQuickView } from '../ui/quick-view.js';
import { createShelfItem, setupShelf, updateShelfArrows } from '../ui/shelf.js';
import '../ui/immersive-header.js';
import { setupHeroTrailer } from '../ui/hero-trailer.js';
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
let trailer = null;
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

function renderTitle(release) {
  if (release.type === 'game') {
    const link = document.createElement('a');
    link.className = 'hero__link';
    link.href = `game.html?id=${release.id}`;
    link.textContent = release.title;
    return link;
  }
  const button = document.createElement('button');
  button.className = 'hero__link billboard__title-button';
  button.type = 'button';
  button.textContent = release.title;
  button.addEventListener('click', () => openQuickView(release, button));
  return button;
}

const ART_WAIT = 1500;

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
    slide.ready = image.decode().catch(() => image.remove());
    heroArt.prepend(image);
  });
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
      dot.addEventListener('click', () => {
        showSlide(index);
        restartTimer();
      });
      return dot;
    }),
  );
  heroControls.hidden = slides.length < 2;
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
  const { release, label, image } = slides[index];
  featured = release;

  heroEyebrow.textContent = `${label} · ${getTypeLabel(release)}`;
  heroEyebrow.style.setProperty('--eyebrow-accent', `var(--color-category-${release.type === 'game' ? 'games' : release.type === 'movie' ? 'movies' : release.type})`);
  heroTitle.replaceChildren(renderTitle(release));
  heroMeta.textContent = getMeta(release);
  heroDetails.hidden = release.type !== 'game';
  heroDetails.href = `game.html?id=${release.id}`;
  renderHeroSave();
  startCountdown(release);

  previous?.image.classList.remove('is-active');
  image.classList.add('is-active');
  trailer?.setEnabled(index === 0);
  [...heroDots.children].forEach((dot, dotIndex) => {
    dot.setAttribute('aria-current', String(dotIndex === index));
  });

  if (first) playHeroIntro(hero);
  else swapBillboard(image, heroSlide);
}

// Auto-advance waits while someone is reading or watching: pointer or focus inside, a trailer playing,
// the tab hidden, or the pause button pressed (which reduced motion starts on).
function advance() {
  const busy = holding || trailer?.isActive();
  if (!paused && !busy && !document.hidden && slides.length > 1) showSlide((current + 1) % slides.length);
}

function restartTimer() {
  clearInterval(slideTimer);
  slideTimer = setInterval(advance, SLIDE_TIME);
}

function renderPause() {
  heroPause.setAttribute('aria-pressed', String(paused));
  heroPause.setAttribute('aria-label', paused ? 'Play the featured releases' : 'Pause the featured releases');
}

// YouTube finds the official trailer for almost any game; RAWG only has clips for games on Steam.
async function findTrailer(game) {
  const fromYouTube = await youtube.findTrailer(game.title).catch(() => null);
  return fromYouTube ?? rawg.getTrailer(game.id);
}

// The trailer is extra: it loads after the billboard is on screen, and only for the featured game.
function loadTrailer(game) {
  findTrailer(game)
    .then((found) => {
      if (!found) return;
      trailer = setupHeroTrailer({ hero, media: heroArt, playButton: heroTrailer, soundButton: heroSound, trailer: found, title: game.title });
      trailer.setEnabled(current === 0);
    })
    .catch(() => {});
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
    showSlide(0);
    renderPause();
    restartTimer();
    if (slides[0].release.type === 'game') loadTrailer(slides[0].release);
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

heroPause.addEventListener('click', () => {
  paused = !paused;
  renderPause();
  restartTimer();
});

heroSave.addEventListener('click', () => toggleSave(featured));

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
