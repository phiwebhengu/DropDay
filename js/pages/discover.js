import * as rawg from '../api/rawg.js';
import * as tmdb from '../api/tmdb.js';
import { RAWG_PLATFORMS } from '../config.js';
import { getMonthRange, getQuickRange, toMonthKey } from '../utils/dates.js';
import { createReleaseCard, createCardSkeleton } from '../ui/card.js';

const SKELETON_COUNT = 10;
const MONTHS_AHEAD = 12;
const OLDER_PLATFORM_COUNT = 8;
const FILTER_DELAY = 300;

const CATEGORIES = {
  games: { label: 'Games', one: 'game', many: 'games', load: rawg.getGames, loadGenres: rawg.getGenres },
  movies: { label: 'Movies', one: 'movie', many: 'movies', load: tmdb.getMovies, loadGenres: () => tmdb.getGenres('movie') },
  tv: { label: 'TV shows', one: 'TV show', many: 'TV shows', load: tmdb.getShows, loadGenres: () => tmdb.getGenres('tv') },
  anime: { label: 'Anime', one: 'anime', many: 'anime', load: tmdb.getAnime, loadGenres: () => tmdb.getGenres('tv') },
};

const RANGES = {
  week: 'this week',
  month: 'this month',
  quarter: 'in the next 3 months',
};

const CURRENT_PLATFORM_IDS = [RAWG_PLATFORMS.pc, RAWG_PLATFORMS.ps5, RAWG_PLATFORMS.xboxSeries, RAWG_PLATFORMS.switch];
const ANIMATION_GENRE_ID = 16;

const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });

const tabs = [...document.querySelectorAll('.category-tab')];
const rangeButtons = [...document.querySelectorAll('.quick-range__option')];
const monthSelect = document.getElementById('filter-month');
const platformSelect = document.getElementById('filter-platform');
const genreSelect = document.getElementById('filter-genre');
const platformField = document.getElementById('platform-field');
const panel = document.getElementById('discover-results');
const grid = document.getElementById('release-grid');
const summary = document.getElementById('discover-summary');
const loadMoreButton = document.getElementById('load-more');

// Bumped on every request, so a slow response for an old view can't overwrite the current one.
let requestId = 0;
let resultCount = null;
let nextPage = null;
let genresFor = null;
let filterTimer;

function isId(value) {
  return /^\d+$/.test(value ?? '');
}

function readState() {
  const params = new URLSearchParams(location.search);
  const cat = Object.hasOwn(CATEGORIES, params.get('cat')) ? params.get('cat') : 'games';
  const month = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month') : '';
  const range = Object.hasOwn(RANGES, params.get('range')) ? params.get('range') : 'month';
  return {
    cat,
    month,
    range: month ? '' : range,
    platform: cat === 'games' && isId(params.get('platform')) ? params.get('platform') : '',
    genre: isId(params.get('genre')) ? params.get('genre') : '',
  };
}

function writeState(state) {
  const params = new URLSearchParams();
  Object.entries(state).forEach(([name, value]) => {
    if (value) params.set(name, value);
  });
  history.replaceState(null, '', `?${params}`);
}

function getDates({ month, range }) {
  return month ? getMonthRange(month) : getQuickRange(range);
}

function selectedText(select) {
  return select.value ? select.selectedOptions[0]?.textContent : '';
}

const countFormat = new Intl.NumberFormat('en-ZA');

// The count is only known once results arrive; TV and anime are filtered after fetching, so they have no total.
function getSubject(cat) {
  const { label, one, many } = CATEGORIES[cat];
  if (resultCount === null) return label;
  if (resultCount === 0) return `No ${many}`;
  return `${countFormat.format(resultCount)} ${resultCount === 1 ? one : many}`;
}

function renderSummary(state) {
  const when = state.month ? `in ${selectedText(monthSelect) || state.month}` : RANGES[state.range];
  const platform = selectedText(platformSelect);
  const genre = selectedText(genreSelect);
  let text = `${getSubject(state.cat)} dropping ${when}`;
  if (platform) text += ` on ${platform}`;
  if (genre) text += ` · ${genre}`;
  summary.textContent = text;
}

function renderControls(state) {
  tabs.forEach((tab) => {
    const selected = tab.dataset.cat === state.cat;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  panel.setAttribute('aria-labelledby', `tab-${state.cat}`);

  rangeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.range === state.range));
  });

  platformField.hidden = state.cat !== 'games';
  monthSelect.value = state.month;
  platformSelect.value = state.platform;
  genreSelect.value = state.genre;
}

function createOption(value, text) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = text;
  return option;
}

function fillMonthOptions() {
  const today = new Date();
  for (let offset = 0; offset < MONTHS_AHEAD; offset += 1) {
    const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    monthSelect.append(createOption(toMonthKey(date), monthFormat.format(date)));
  }
}

// Current-gen platforms first; everything else sits in its own group, most-used first.
async function fillPlatformOptions() {
  const platforms = await rawg.getPlatforms();
  const current = CURRENT_PLATFORM_IDS.map((id) => platforms.find((platform) => platform.id === id)).filter(Boolean);
  const older = platforms
    .filter((platform) => !CURRENT_PLATFORM_IDS.includes(platform.id))
    .sort((a, b) => b.gamesCount - a.gamesCount)
    .slice(0, OLDER_PLATFORM_COUNT);

  const olderGroup = document.createElement('optgroup');
  olderGroup.label = 'Older and other platforms';
  olderGroup.append(...older.map(({ id, name }) => createOption(id, name)));
  platformSelect.append(...current.map(({ id, name }) => createOption(id, name)), olderGroup);
}

async function fillGenreOptions(cat) {
  if (genresFor === cat) return;
  genresFor = cat;
  const genres = await CATEGORIES[cat].loadGenres();
  if (genresFor !== cat) return;
  const usable = cat === 'anime' ? genres.filter((genre) => genre.id !== ANIMATION_GENRE_ID) : genres;
  genreSelect.replaceChildren(createOption('', 'All genres'), ...usable.map(({ id, name }) => createOption(id, name)));
}

function wrapInListItem(element) {
  const item = document.createElement('li');
  item.append(element);
  return item;
}

function getQuery(state, page) {
  return { ...getDates(state), platforms: state.platform, genres: state.genre, page };
}

function appendCards(results) {
  grid.append(...results.map((release) => wrapInListItem(createReleaseCard(release))));
}

function setNextPage(response) {
  nextPage = response.hasMore ? response.page + 1 : null;
  loadMoreButton.hidden = nextPage === null;
}

async function loadReleases(state) {
  const id = ++requestId;
  resultCount = null;
  setNextPage({ hasMore: false });
  renderSummary(state);
  grid.setAttribute('aria-busy', 'true');
  grid.replaceChildren(...Array.from({ length: SKELETON_COUNT }, () => wrapInListItem(createCardSkeleton())));

  try {
    const response = await CATEGORIES[state.cat].load(getQuery(state, 1));
    if (id !== requestId) return;
    grid.replaceChildren();
    appendCards(response.results);
    resultCount = response.count ?? (response.hasMore ? null : response.results.length);
    setNextPage(response);
    renderSummary(state);
  } catch {
    // Proper error and empty states (with Retry) come in #11.
    if (id !== requestId) return;
    grid.replaceChildren();
    summary.textContent = 'We could not load releases. Check your connection and try again.';
  } finally {
    if (id === requestId) grid.setAttribute('aria-busy', 'false');
  }
}

async function loadMore() {
  const id = requestId;
  const state = readState();
  loadMoreButton.setAttribute('aria-busy', 'true');
  loadMoreButton.disabled = true;

  try {
    const response = await CATEGORIES[state.cat].load(getQuery(state, nextPage));
    if (id !== requestId) return;
    appendCards(response.results);
    setNextPage(response);
  } catch {
    // Leave the button in place so the user can simply try again.
  } finally {
    loadMoreButton.removeAttribute('aria-busy');
    loadMoreButton.disabled = false;
  }
}

function update(changes) {
  const state = { ...readState(), ...changes };
  writeState(state);
  renderControls(state);
  loadReleases(state);

  fillGenreOptions(state.cat)
    .then(() => {
      genreSelect.value = state.genre;
      renderSummary(state);
    })
    .catch(() => {});
}

// Selects can fire several change events in a row (arrow keys in Firefox), so wait for the user to settle.
function updateAfterPause(changes) {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => update(changes), FILTER_DELAY);
}

tabs.forEach((tab, index) => {
  // Genre and platform ids mean different things per category, so they reset on a tab change.
  tab.addEventListener('click', () => update({ cat: tab.dataset.cat, genre: '', platform: '' }));

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
  button.addEventListener('click', () => update({ range: button.dataset.range, month: '' }));
});

monthSelect.addEventListener('change', () => {
  updateAfterPause(monthSelect.value ? { month: monthSelect.value, range: '' } : { month: '', range: 'month' });
});
platformSelect.addEventListener('change', () => updateAfterPause({ platform: platformSelect.value }));
genreSelect.addEventListener('change', () => updateAfterPause({ genre: genreSelect.value }));
loadMoreButton.addEventListener('click', loadMore);

fillMonthOptions();
fillPlatformOptions()
  .then(() => {
    const state = readState();
    platformSelect.value = state.platform;
    renderSummary(state);
  })
  .catch(() => {});

update({});
