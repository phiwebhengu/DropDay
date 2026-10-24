import * as rawg from '../api/rawg.js';
import * as tmdb from '../api/tmdb.js';
import { getStatus, listByStatus } from '../store/library.js';
import { createReleaseCard, createCardSkeleton, getSaveText } from '../ui/card.js';
import { setReleaseStatus, syncCards, toggleSave } from '../ui/library-actions.js';
import { createLibraryRow } from '../ui/library-row.js';
import { openQuickView } from '../ui/quick-view.js';
import { createStateMessage } from '../ui/states.js';
import { playHeroIntro, setupPinnedStrip, tickDigit } from '../motion.js';
import { formatReleaseDate, getMonthRange, toMonthKey } from '../utils/dates.js';

const SKELETON_DELAY = 150;
const PER_CATEGORY = 3;
const STRIP_SIZE = 10;
const BACKLOG_ROWS = 2;
const MAX_HERO_PLATFORMS = 3;

const PLATFORM_NAMES = {
  'Xbox Series S/X': 'Xbox Series X|S',
  'PlayStation 5': 'PS5',
  'PlayStation 4': 'PS4',
  'Nintendo Switch': 'Switch',
};

const hero = document.getElementById('hero');
const heroEyebrow = document.getElementById('hero-eyebrow');
const heroTitle = document.getElementById('hero-title');
const heroMeta = document.getElementById('hero-meta');
const heroSave = document.getElementById('hero-save');
const heroArt = document.getElementById('hero-art');
const countdown = document.getElementById('countdown');
const countdownValues = Object.fromEntries(
  [...countdown.querySelectorAll('[data-unit]')].map((element) => [element.dataset.unit, element]),
);
const monthStrip = document.getElementById('month-strip');
const monthState = document.getElementById('month-state');
const monthSection = document.getElementById('month-section');
const monthProgress = document.getElementById('month-progress');
const backlogList = document.getElementById('backlog-list');
const backlogEmpty = document.getElementById('backlog-empty');

let featured = null;
let countdownTimer;
let countdownStarted = false;
let stripMotion = null;

/* Hero */

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
    heroMeta.textContent = `Out now · ${heroMeta.dataset.platforms}`;
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

function renderHeroSave() {
  const status = getStatus(featured);
  heroSave.disabled = false;
  heroSave.setAttribute('aria-pressed', String(Boolean(status)));
  heroSave.textContent = status ? getSaveText('game', status) : '+ Add to Radar';
}

function renderHero(game) {
  featured = game;
  hero.setAttribute('aria-busy', 'false');
  heroEyebrow.textContent = 'Featured launch · Game';

  const link = document.createElement('a');
  link.className = 'hero__link';
  link.href = `game.html?id=${game.id}`;
  link.textContent = game.title;
  heroTitle.replaceChildren(link);

  const platforms = game.platforms
    .slice(0, MAX_HERO_PLATFORMS)
    .map((name) => PLATFORM_NAMES[name] ?? name)
    .join(' · ');
  heroMeta.dataset.platforms = platforms;
  heroMeta.textContent = [game.tba ? 'Release date TBA' : formatReleaseDate(game.date), platforms].filter(Boolean).join(' · ');

  heroArt.href = link.href;
  heroArt.classList.remove('skeleton');
  heroArt.replaceChildren();
  if (game.cover) {
    const image = document.createElement('img');
    image.className = 'hero__image';
    image.src = game.cover;
    image.alt = '';
    image.addEventListener('error', () => image.remove(), { once: true });
    heroArt.append(image);
  }

  renderHeroSave();
  countdown.hidden = game.tba || !game.date;
  if (!countdown.hidden) {
    tick();
    clearInterval(countdownTimer);
    countdownTimer = setInterval(tick, 1000);
  }
  playHeroIntro(hero);
}

function renderHeroMessage(message) {
  hero.setAttribute('aria-busy', 'false');
  hero.classList.add('hero--message');
  heroEyebrow.textContent = 'Featured launch';
  heroTitle.textContent = 'Drop Day';
  heroMeta.textContent = '';
  heroArt.hidden = true;
  countdown.hidden = true;
  heroSave.hidden = true;
  heroMeta.after(message);
}

async function loadHero() {
  try {
    const { game } = await rawg.getFeaturedGame();
    if (game) renderHero(game);
    else {
      renderHeroMessage(
        createStateMessage({
          type: 'empty',
          title: 'No big launches in the next 90 days',
          text: 'Browse everything dropping soon instead.',
        }),
      );
    }
  } catch {
    renderHeroMessage(
      createStateMessage({
        type: 'error',
        title: "The featured launch couldn't load",
        text: 'Check your connection, then try again.',
        actionLabel: 'Retry',
        onAction: () => location.reload(),
      }),
    );
  }
}

/* Dropping this month */

function wrapInListItem(element) {
  const item = document.createElement('li');
  item.append(element);
  return item;
}

// Takes one from each category in turn, so the strip shows the mix instead of a block of games.
function interleave(lists) {
  const mixed = [];
  for (let index = 0; index < PER_CATEGORY; index += 1) {
    lists.forEach((list) => {
      if (list[index]) mixed.push(list[index]);
    });
  }
  return mixed.slice(0, STRIP_SIZE);
}

async function loadMonth() {
  // Skeletons only appear if loading takes a moment, so fast (cached) loads don't flash.
  const skeletonTimer = setTimeout(() => {
    monthStrip.replaceChildren(...Array.from({ length: 5 }, () => wrapInListItem(createCardSkeleton())));
  }, SKELETON_DELAY);

  const range = getMonthRange(toMonthKey(new Date()));
  const requests = [
    rawg.getGames({ ...range, ordering: '-added' }),
    tmdb.getMovies(range),
    tmdb.getShows(range),
    tmdb.getAnime(range),
  ];
  // One category failing shouldn't empty the whole strip.
  const results = await Promise.allSettled(requests);
  clearTimeout(skeletonTimer);
  monthStrip.setAttribute('aria-busy', 'false');

  const lists = results.map((result) => (result.status === 'fulfilled' ? result.value.results : []));
  const releases = interleave(lists);

  if (!releases.length) {
    monthStrip.replaceChildren();
    monthStrip.hidden = true;
    const failed = results.every((result) => result.status === 'rejected');
    monthState.replaceChildren(
      createStateMessage(
        failed
          ? {
              type: 'error',
              title: "This month's releases couldn't load",
              text: 'Check your connection, then try again.',
              actionLabel: 'Retry',
              onAction: () => {
                monthState.hidden = true;
                monthStrip.hidden = false;
                loadMonth();
              },
            }
          : {
              type: 'empty',
              title: 'Nothing dropping this month',
              text: 'Look further ahead on Discover.',
              actionLabel: 'Next 3 months',
              onAction: () => {
                location.href = 'discover.html?range=quarter';
              },
            },
      ),
    );
    monthState.hidden = false;
    return;
  }

  monthStrip.replaceChildren(
    ...releases.map((release) => wrapInListItem(createReleaseCard(release, { status: getStatus(release) }))),
  );
  stripMotion?.revert();
  stripMotion = setupPinnedStrip(monthSection, monthStrip, monthProgress);
}

/* Continue your Backlog: localStorage only, so it renders even offline */

function renderBacklog() {
  const entries = listByStatus('backlog').slice(0, BACKLOG_ROWS);
  backlogEmpty.hidden = entries.length > 0;
  backlogList.replaceChildren(...entries.map((entry) => createLibraryRow(entry)));
}

heroSave.addEventListener('click', () => {
  const status = getStatus(featured);
  if (!status) setReleaseStatus(featured, 'radar');
  else if (status === 'radar') toggleSave(featured);
  else location.href = `game.html?id=${featured.id}`;
});

monthStrip.addEventListener('release:save', (event) => toggleSave(event.detail.release));
monthStrip.addEventListener('release:quickview', (event) => {
  openQuickView(event.detail.release, event.target.querySelector('.release-card__link'));
});

window.addEventListener('library:change', () => {
  if (featured) renderHeroSave();
  syncCards(monthStrip);
  renderBacklog();
});

renderBacklog();
loadHero();
loadMonth();
