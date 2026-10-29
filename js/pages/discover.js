import * as anilist from '../api/anilist.js';
import * as rawg from '../api/rawg.js';
import * as tmdb from '../api/tmdb.js';
import { RAWG_PLATFORMS } from '../config.js';
import { formatTime, getMonthRange, getQuickRange, toMonthKey } from '../utils/dates.js';
import { createReleaseCard, createCardSkeleton } from '../ui/card.js';
import { createStateMessage } from '../ui/states.js';
import { openQuickView } from '../ui/quick-view.js';
import { animateGrid, captureGrid } from '../motion.js';
import { syncCards, toggleSave } from '../ui/library-actions.js';
import { getEntry } from '../store/library.js';
import '../ui/save-feedback.js';
import '../ui/theme.js';

const SKELETON_COUNT = 10;
const SKELETON_DELAY = 150;
const MONTHS_AHEAD = 12;
const OLDER_PLATFORM_COUNT = 8;
const FILTER_DELAY = 300;
const SCROLL_KEY_PREFIX = 'dropday.discover.scroll.';
const RETURN_KEY = 'dropday.discover.return';
const MAX_QUERY_LENGTH = 100;

const CATEGORIES = {
  games: {
    label: 'Games',
    one: 'game',
    many: 'games',
    load: rawg.getGames,
    search: ({ query, page }) => rawg.getGames({ search: query, page }),
    loadGenres: rawg.getGenres,
  },
  movies: {
    label: 'Movies',
    one: 'movie',
    many: 'movies',
    load: tmdb.getMovies,
    search: tmdb.searchMovies,
    loadGenres: () => tmdb.getGenres('movie'),
  },
  tv: {
    label: 'TV shows',
    one: 'TV show',
    many: 'TV shows',
    load: tmdb.getShows,
    search: tmdb.searchShows,
    loadGenres: () => tmdb.getGenres('tv'),
  },
  anime: {
    label: 'Anime',
    one: 'anime',
    many: 'anime',
    load: anilist.getAnime,
    search: anilist.searchAnime,
    loadGenres: anilist.getGenres,
  },
  manga: {
    label: 'Manga',
    one: 'manga',
    many: 'manga',
    load: anilist.getManga,
    search: anilist.searchManga,
    loadGenres: anilist.getGenres,
  },
};

const RANGE_LABELS = {
  week: 'This week',
  month: 'This month',
  quarter: 'Next 3 months',
};

const RANGES = {
  week: 'this week',
  month: 'this month',
  quarter: 'in the next 3 months',
};

const CURRENT_PLATFORM_IDS = [RAWG_PLATFORMS.pc, RAWG_PLATFORMS.ps5, RAWG_PLATFORMS.xboxSeries, RAWG_PLATFORMS.switch];

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
const note = document.getElementById('discover-note');
const stateBox = document.getElementById('discover-state');
const quickRange = document.getElementById('quick-range');
const filters = document.getElementById('discover-filters');
const clearSearchButton = document.getElementById('search-clear');
const searchForms = [...document.querySelectorAll('form[role="search"]')];
const pageSearchInput = document.getElementById('discover-search');

// Bumped on every request, so a slow response for an old view can't overwrite the current one.
let requestId = 0;
let resultCount = null;
let loadFailed = false;
let pagesLoaded = 0;
let nextPage = null;
let genresFor = null;
let filterTimer;

function isId(value) {
  return /^\d+$/.test(value ?? '');
}

// RAWG and TMDB genres are numbers; AniList's are names like "Slice of Life" or "Sci-Fi".
function isValidGenre(cat, value) {
  if (cat === 'anime' || cat === 'manga') return /^[\w &-]{1,40}$/.test(value ?? '');
  return isId(value);
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
    genre: isValidGenre(cat, params.get('genre')) ? params.get('genre') : '',
    q: (params.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH),
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
  if (loadFailed) {
    summary.textContent = `${CATEGORIES[state.cat].label} couldn't load`;
    return;
  }
  if (state.q) {
    summary.textContent = resultCount === null ? `Results for “${state.q}”` : `${getSubject(state.cat)} found for “${state.q}”`;
    return;
  }
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

  // Search looks across all dates, so the date and filter controls step aside while it's on.
  quickRange.hidden = Boolean(state.q);
  filters.hidden = Boolean(state.q);
  clearSearchButton.hidden = !state.q;
  searchForms.forEach((form) => {
    form.elements.q.value = state.q;
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

// The list empties first, so a failed load never leaves another category's genres behind,
// and genresFor is cleared on failure so the next visit tries again.
async function fillGenreOptions(cat) {
  if (genresFor === cat) return;
  genresFor = cat;
  genreSelect.replaceChildren(createOption('', 'All genres'));
  let genres;
  try {
    genres = await CATEGORIES[cat].loadGenres();
  } catch (error) {
    if (genresFor === cat) genresFor = null;
    throw error;
  }
  if (genresFor !== cat) return;
  genreSelect.replaceChildren(createOption('', 'All genres'), ...genres.map(({ id, name }) => createOption(id, name)));
}

function wrapInListItem(element) {
  const item = document.createElement('li');
  item.append(element);
  return item;
}

function fetchPage(state, page) {
  const category = CATEGORIES[state.cat];
  if (state.q) return category.search({ query: state.q, page });
  return category.load({ ...getDates(state), platforms: state.platform, genres: state.genre, page });
}

function appendCards(results) {
  const cards = results.map((release) => createReleaseCard(release, { entry: getEntry(release) }));
  grid.append(...cards.map(wrapInListItem));
  return cards;
}

function setNextPage(response) {
  nextPage = response.hasMore ? response.page + 1 : null;
  loadMoreButton.hidden = nextPage === null;
}

function showState(message) {
  stateBox.replaceChildren(message);
  stateBox.hidden = false;
  grid.hidden = true;
}

function hideState() {
  stateBox.replaceChildren();
  stateBox.hidden = true;
  grid.hidden = false;
}

// The cache hands back the last good response when the network fails; say so rather than pretend it is live.
function renderStaleNote(response) {
  note.hidden = !response.isStale;
  note.textContent = response.isStale ? `You're offline. Showing saved results from ${formatTime(response.savedAt)}.` : '';
}

function clearFilters() {
  update({ month: '', range: 'month', platform: '', genre: '' });
}

function clearSearch() {
  update({ q: '' });
}

function hasFilters(state) {
  return Boolean(state.month || state.platform || state.genre || state.range !== 'month');
}

async function loadReleases(state) {
  const id = ++requestId;
  resultCount = null;
  loadFailed = false;
  pagesLoaded = 0;
  setNextPage({ hasMore: false });
  hideState();
  note.hidden = true;
  renderSummary(state);
  grid.setAttribute('aria-busy', 'true');

  // The current cards stay (dimmed) while the next set loads, so Flip can move the ones that stay.
  // Skeletons only replace them if loading takes longer than 150 ms (PRD loading state).
  let flipState = captureGrid(grid);
  const skeletonTimer = setTimeout(() => {
    flipState = null;
    grid.replaceChildren(...Array.from({ length: SKELETON_COUNT }, () => wrapInListItem(createCardSkeleton())));
  }, SKELETON_DELAY);

  try {
    const response = await fetchPage(state, 1);
    if (id !== requestId) return;
    clearTimeout(skeletonTimer);
    grid.replaceChildren();
    animateGrid(appendCards(response.results), flipState);
    pagesLoaded = 1;
    resultCount = response.count ?? (response.hasMore ? null : response.results.length);
    setNextPage(response);
    renderSummary(state);
    renderStaleNote(response);

    if (response.results.length === 0) {
      const message = state.q
        ? {
            title: `No ${CATEGORIES[state.cat].many} match “${state.q}”`,
            text: 'Check the spelling, or try another category.',
            actionLabel: 'Clear search',
            onAction: clearSearch,
          }
        : hasFilters(state)
        ? {
            title: 'No releases match your filters',
            text: 'Try a different month, platform or genre.',
            actionLabel: 'Clear filters',
            onAction: clearFilters,
          }
        : {
            title: 'Nothing dropping here yet',
            text: 'Try another category or look further ahead.',
            actionLabel: 'Show next 3 months',
            onAction: () => update({ range: 'quarter', month: '' }),
          };
      showState(createStateMessage({ type: 'empty', ...message }));
    }
  } catch (error) {
    if (id !== requestId) return;
    clearTimeout(skeletonTimer);
    grid.replaceChildren();
    loadFailed = true;
    renderSummary(state);
    showState(
      createStateMessage({
        type: 'error',
        title: 'We could not load releases',
        // AniList allows a limited number of requests a minute, so a fast browse can hit it.
        text: error?.status === 429 ? 'Too many requests at once. Wait a minute, then try again.' : 'Check your connection, then try again.',
        actionLabel: 'Retry',
        onAction: () => update({}),
      }),
    );
  } finally {
    if (id === requestId) grid.setAttribute('aria-busy', 'false');
  }
}

async function loadMore({ animate = true } = {}) {
  const id = requestId;
  const state = readState();
  loadMoreButton.setAttribute('aria-busy', 'true');
  loadMoreButton.disabled = true;

  try {
    const response = await fetchPage(state, nextPage);
    if (id !== requestId) return;
    const cards = appendCards(response.results);
    if (animate) animateGrid(cards);
    pagesLoaded += 1;
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
  const loaded = loadReleases(state);

  fillGenreOptions(state.cat)
    .then(() => {
      genreSelect.value = state.genre;
      renderSummary(state);
    })
    .catch(() => {});

  return loaded;
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
loadMoreButton.addEventListener('click', () => loadMore());
grid.addEventListener('release:save', (event) => toggleSave(event.detail.release));
window.addEventListener('library:change', () => syncCards(grid));
grid.addEventListener('release:quickview', (event) => {
  openQuickView(event.detail.release, event.target.querySelector('.release-card__link'));
});
// Desktop uses the header field and phones use the one on the page; only one is visible at a time.
function focusVisibleSearch() {
  const input = searchForms.map((form) => form.elements.q).find((field) => field.offsetParent !== null);
  input?.focus();
}

clearSearchButton.addEventListener('click', () => {
  clearSearch();
  focusVisibleSearch();
});

// Already on Discover, so search in place and keep the chosen category instead of reloading.
searchForms.forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = form.elements.q.value.trim();
    if (query !== readState().q) update({ q: query });
    form.elements.q.blur();
  });
});

// The mobile header icon links to #search, so arriving from another page or tapping it here lands in the field.
document.querySelector('.site-header__search-link').addEventListener('click', (event) => {
  event.preventDefault();
  pageSearchInput.focus();
});

// Wait a frame so the stylesheet has shown the field; a hidden input can't take focus.
if (location.hash === '#search') requestAnimationFrame(() => pageSearchInput.focus());

fillMonthOptions();
fillPlatformOptions()
  .then(() => {
    const state = readState();
    platformSelect.value = state.platform;
    renderSummary(state);
  })
  .catch(() => {});

// Back from a game page should land where the user left off (PRD design goal 2). Filters already live in the URL;
// this keeps the scroll position and how many pages were loaded, per URL, for this tab only.
function scrollKey() {
  return SCROLL_KEY_PREFIX + location.search;
}

function saveScroll() {
  try {
    sessionStorage.setItem(scrollKey(), JSON.stringify({ y: window.scrollY, pages: pagesLoaded }));
  } catch {}
}

function readSavedScroll() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(scrollKey()));
    sessionStorage.removeItem(scrollKey());
    return saved;
  } catch {
    return null;
  }
}

async function restoreScroll(saved) {
  if (!saved) return;
  while (pagesLoaded < saved.pages && nextPage !== null) {
    const before = pagesLoaded;
    await loadMore({ animate: false });
    if (pagesLoaded === before) break;
  }
  window.scrollTo(0, saved.y);
}

// Game detail's "Back to results" link reads this to say where it goes, e.g. "Games · Nov 2026 · PS5".
function getResultsLabel(state) {
  if (state.q) return `“${state.q}”`;
  const when = state.month ? selectedText(monthSelect) : RANGE_LABELS[state.range];
  const parts = [CATEGORIES[state.cat].label, when, selectedText(platformSelect)];
  return parts.filter(Boolean).join(' · ');
}

function saveReturnLink() {
  try {
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({ search: location.search, label: getResultsLabel(readState()) }));
  } catch {}
}

history.scrollRestoration = 'manual';
window.addEventListener('pagehide', saveScroll);
window.addEventListener('pagehide', saveReturnLink);

const savedScroll = readSavedScroll();
update({}).then(() => restoreScroll(savedScroll));
