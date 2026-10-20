import * as rawg from '../api/rawg.js';
import * as tmdb from '../api/tmdb.js';
import { getQuickRange } from '../utils/dates.js';
import { createReleaseCard, createCardSkeleton } from '../ui/card.js';

const SKELETON_COUNT = 10;

const CATEGORIES = {
  games: { label: 'Games', load: rawg.getGames },
  movies: { label: 'Movies', load: tmdb.getMovies },
  tv: { label: 'TV shows', load: tmdb.getShows },
  anime: { label: 'Anime', load: tmdb.getAnime },
};

const RANGES = {
  week: 'this week',
  month: 'this month',
  quarter: 'in the next 3 months',
};

const tabs = [...document.querySelectorAll('.category-tab')];
const rangeButtons = [...document.querySelectorAll('.quick-range__option')];
const panel = document.getElementById('discover-results');
const grid = document.getElementById('release-grid');
const summary = document.getElementById('discover-summary');

// Bumped on every request, so a slow response for an old tab can't overwrite the current one.
let requestId = 0;

function readState() {
  const params = new URLSearchParams(location.search);
  const cat = params.get('cat');
  const range = params.get('range');
  return {
    cat: Object.hasOwn(CATEGORIES, cat) ? cat : 'games',
    range: Object.hasOwn(RANGES, range) ? range : 'month',
  };
}

function writeState(state) {
  const params = new URLSearchParams(location.search);
  params.set('cat', state.cat);
  params.set('range', state.range);
  history.replaceState(null, '', `?${params}`);
}

function renderControls({ cat, range }) {
  tabs.forEach((tab) => {
    const selected = tab.dataset.cat === cat;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  panel.setAttribute('aria-labelledby', `tab-${cat}`);

  rangeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.range === range));
  });
}

function wrapInListItem(element) {
  const item = document.createElement('li');
  item.append(element);
  return item;
}

async function loadReleases(state) {
  const id = ++requestId;
  const { label, load } = CATEGORIES[state.cat];

  summary.textContent = `${label} dropping ${RANGES[state.range]}`;
  grid.setAttribute('aria-busy', 'true');
  grid.replaceChildren(...Array.from({ length: SKELETON_COUNT }, () => wrapInListItem(createCardSkeleton())));

  try {
    const { results } = await load(getQuickRange(state.range));
    if (id !== requestId) return;
    grid.replaceChildren(...results.map((release) => wrapInListItem(createReleaseCard(release))));
  } catch {
    // Proper error and empty states (with Retry) come in #11.
    if (id !== requestId) return;
    grid.replaceChildren();
    summary.textContent = 'We could not load releases. Check your connection and try again.';
  } finally {
    if (id === requestId) grid.setAttribute('aria-busy', 'false');
  }
}

function update(changes) {
  const state = { ...readState(), ...changes };
  writeState(state);
  renderControls(state);
  loadReleases(state);
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => update({ cat: tab.dataset.cat }));

  // Arrow keys move between tabs (WAI-ARIA tabs pattern); Tab moves on to the panel.
  tab.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    const next = tabs[(index + step + tabs.length) % tabs.length];
    next.focus();
    next.click();
  });
});

rangeButtons.forEach((button) => {
  button.addEventListener('click', () => update({ range: button.dataset.range }));
});

update({});
