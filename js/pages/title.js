import { getEntry, setUnits, undo } from '../store/library.js';
import { createReleaseCard, getDateText } from '../ui/card.js';
import { removeRelease, setReleaseStatus, setReminder, syncCards, toggleSave } from '../ui/library-actions.js';
import { openLogModal } from '../ui/log-modal.js';
import { posterFallback } from '../ui/poster.js';
import { createProviders, getDetails, getFacts, openQuickView } from '../ui/quick-view.js';
import { createStars, formatRating } from '../ui/rating.js';
import { createReview } from '../ui/review.js';
import { createShelfItem, setupShelf, updateShelfArrows } from '../ui/shelf.js';
import { createStateMessage } from '../ui/states.js';
import { createLogo, prepareLogo } from '../ui/title-logo.js';
import { showToast } from '../ui/toast.js';
import { openTrailerDialog } from '../ui/trailer-dialog.js';
import { formatReleaseDate, formatShortDate } from '../utils/dates.js';
import { getStatusesFor, getStatusLabel, getTypeLabel, isReleased } from '../utils/media.js';
import '../ui/save-feedback.js';
import '../ui/theme.js';
import '../ui/site-header.js';

// The page for a film, show, anime or manga: the same layout and Library actions as a game's page,
// with where to watch or read, episode progress and more like it.

const MAX_GENRES = 2;
const MAX_SIMILAR = 12;
const SOURCES = { tmdb: ['movie', 'tv'], anilist: ['anime', 'manga'] };
const RATING_SOURCES = { tmdb: 'TMDB', anilist: 'AniList' };
// Long-running anime (One Piece is past 1,100 episodes) would be a wall of tiles, so they come in ranges.
const EPISODES_PER_RANGE = 100;

const backLink = document.getElementById('back-link');
const backLinkText = document.getElementById('back-link-text');
const stateBox = document.getElementById('title-state');
const hero = document.getElementById('title-hero');
const backdrop = document.getElementById('title-backdrop');
const cover = document.getElementById('title-cover');
const facts = document.getElementById('title-facts');
const providers = document.getElementById('title-providers');
const eyebrow = document.getElementById('title-eyebrow');
const heading = document.getElementById('title-title');
const meta = document.getElementById('title-meta');
const rating = document.getElementById('title-rating');
const statusButtons = [...document.querySelectorAll('.status-button')];
const logButton = document.getElementById('log-button');
const trailerButton = document.getElementById('trailer-button');
const shareButton = document.getElementById('share-button');
const removeButton = document.getElementById('remove-button');
const remindButton = document.getElementById('remind-button');
const remindNote = document.getElementById('remind-note');
const yourLog = document.getElementById('your-log');
const yourLogCard = document.getElementById('your-log-card');
const progress = document.getElementById('title-progress');
const progressCount = document.getElementById('progress-count');
const progressFill = document.getElementById('progress-fill');
const nextButton = document.getElementById('progress-next');
const doneNote = document.getElementById('progress-done');
const upToForm = document.getElementById('progress-upto');
const upToLabel = document.getElementById('progress-upto-label');
const upToInput = document.getElementById('progress-upto-input');
const progressSeasons = document.getElementById('progress-seasons');
const progressRanges = document.getElementById('progress-ranges');
const viewCount = document.getElementById('progress-view-count');
const bulkButton = document.getElementById('progress-bulk');
const progressGrid = document.getElementById('progress-grid');
const about = document.getElementById('title-about');
const description = document.getElementById('title-description');
const readMore = document.getElementById('read-more');
const similar = document.getElementById('title-similar');
const similarList = document.getElementById('similar-list');

const params = new URLSearchParams(location.search);
const request = { source: params.get('source'), type: params.get('type'), id: params.get('id') };
let release = null;
let season = 1;
let rangeStart = 1;
// The last episode tapped, so Shift-clicking another marks every episode in between.
let anchor = null;
const countFormat = new Intl.NumberFormat('en-ZA');

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

// Back goes to the page this was opened from, keeping its scroll when the browser can.
function renderBackLink() {
  if (!document.referrer) return;
  const from = new URL(document.referrer);
  if (from.origin !== location.origin) return;

  const name = from.pathname.split('/').pop();
  const labels = { 'library.html': 'Back to My Library', 'index.html': 'Back to Home', '': 'Back to Home', 'discover.html': 'Back to Discover' };
  if (!labels[name]) return;
  backLink.href = `${name || 'index.html'}${from.search}`;
  backLinkText.textContent = labels[name];
  backLink.addEventListener('click', (event) => {
    if (history.length < 2) return;
    event.preventDefault();
    history.back();
  });
}

function renderStatus() {
  const entry = getEntry(release);
  const status = entry?.status ?? null;
  const allowed = getStatusesFor(release.type);
  const shown = statusButtons.filter((button) => allowed.includes(button.dataset.status));
  const focusable = status ?? shown[0].dataset.status;

  statusButtons.forEach((button) => {
    button.hidden = !allowed.includes(button.dataset.status);
    button.disabled = false;
    button.setAttribute('aria-checked', String(button.dataset.status === status));
    button.tabIndex = button.dataset.status === focusable ? 0 : -1;
  });
  removeButton.hidden = !status;
  logButton.disabled = false;
  logButton.textContent = entry?.loggedAt ? 'Edit your log' : 'Log or review';

  // A reminder only makes sense before release day, and it can only live on this device (no account).
  const remind = Boolean(entry?.remind);
  remindButton.hidden = isReleased(release);
  remindNote.hidden = remindButton.hidden;
  remindButton.setAttribute('aria-pressed', String(remind));
  remindButton.textContent = remind ? '🔔 Reminder on' : '🔔 Remind me';

  renderYourLog();
  renderProgress();
}

// What the user logged, like a Letterboxd review: rating, when, and their words.
function renderYourLog() {
  const entry = getEntry(release);
  yourLog.hidden = !entry?.loggedAt;
  if (yourLog.hidden) return;

  const parts = [createElement('p', 'your-log__meta', `${getStatusLabel(release.type, entry.status)} · Logged ${formatShortDate(entry.loggedAt)}`)];
  if (entry.rating) {
    const stars = createElement('p', 'your-log__rating', '');
    stars.append(createStars(entry.rating), createElement('span', 'your-log__rating-value', formatRating(entry.rating)));
    parts.unshift(stars);
  }
  if (entry.review) parts.push(createReview(entry.review, { spoilers: entry.spoilers }));
  else parts.push(createElement('p', 'your-log__empty', 'No review written. Add a few words any time.'));
  yourLogCard.replaceChildren(...parts);
}

/* Episode progress, saved as units on the Library entry ("s2e5" for a show, "e12" for anime).
   Ticking one off puts the title in In progress. Besides tapping single episodes, there are quick ways
   to mark a lot at once, like Simkl: the next episode, everything up to an episode, a whole season or
   range, and Shift-click runs. Every bulk change can be undone from its toast. */

function getSeasons() {
  if (release.type === 'tv') return release.seasonList ?? [];
  // Anime: all episodes if AniList knows the count, otherwise as many as have aired.
  const aired = release.nextEpisode ? release.nextEpisode.number - 1 : 0;
  const episodes = release.episodes ?? aired;
  return episodes > 0 ? [{ number: 1, episodes }] : [];
}

function getUnitKey(seasonNumber, episode) {
  return release.type === 'tv' ? `s${seasonNumber}e${episode}` : `e${episode}`;
}

// Every episode in watching order.
function listEpisodes(seasons) {
  return seasons.flatMap(({ number, episodes }) =>
    Array.from({ length: episodes }, (_, index) => ({
      season: number,
      episode: index + 1,
      key: getUnitKey(number, index + 1),
    })),
  );
}

function isWatched(key) {
  return Boolean(getEntry(release)?.units?.[key]?.watched);
}

function getEpisodeName({ season: seasonNumber, episode }, seasons) {
  return seasons.length > 1 ? `S${seasonNumber} E${episode}` : `episode ${countFormat.format(episode)}`;
}

function getRangeStart(episode) {
  return Math.floor((episode - 1) / EPISODES_PER_RANGE) * EPISODES_PER_RANGE + 1;
}

// Shows the season and range an episode is in, so a change made from the buttons is visible.
function showEpisode({ season: seasonNumber, episode }) {
  season = seasonNumber;
  rangeStart = getRangeStart(episode);
}

function renderSeasonTabs(seasons) {
  progressSeasons.hidden = seasons.length < 2;
  if (progressSeasons.hidden) return;
  progressSeasons.replaceChildren(
    ...seasons.map(({ number }) => {
      const tab = createElement('button', 'category-tab', `Season ${number}`);
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(number === season));
      tab.tabIndex = number === season ? 0 : -1;
      tab.addEventListener('click', () => {
        season = number;
        rangeStart = 1;
        renderProgress();
        progressSeasons.querySelector('[aria-selected="true"]')?.focus();
      });
      return tab;
    }),
  );
}

// Seasons over 100 episodes are split into ranges (1–100, 101–200…), each marked once it's all watched.
function renderRanges(current) {
  progressRanges.hidden = current.episodes <= EPISODES_PER_RANGE;
  if (progressRanges.hidden) return;
  const ranges = [];
  for (let first = 1; first <= current.episodes; first += EPISODES_PER_RANGE) {
    const last = Math.min(current.episodes, first + EPISODES_PER_RANGE - 1);
    const complete = listRange(first, last).every(isWatched);
    const button = createElement('button', 'progress__range', `${first}–${last}`);
    button.type = 'button';
    button.classList.toggle('progress__range--complete', complete);
    button.setAttribute('aria-pressed', String(first === rangeStart));
    button.setAttribute('aria-label', `Episodes ${first} to ${last}${complete ? ', all watched' : ''}`);
    button.addEventListener('click', () => {
      rangeStart = first;
      renderProgress();
      progressRanges.querySelector('[aria-pressed="true"]')?.focus();
    });
    ranges.push(button);
  }
  progressRanges.replaceChildren(...ranges);
}

function listRange(first, last) {
  return Array.from({ length: last - first + 1 }, (_, index) => getUnitKey(season, first + index));
}

function getViewName(current, seasons, first, last) {
  const parts = [];
  if (seasons.length > 1) parts.push(`season ${season}`);
  if (current.episodes > EPISODES_PER_RANGE) parts.push(`episodes ${first}–${last}`);
  return parts.join(', ') || 'all episodes';
}

function renderProgress() {
  const seasons = release.type === 'tv' || release.type === 'anime' ? getSeasons() : [];
  progress.hidden = !seasons.length;
  if (progress.hidden) return;

  const current = seasons.find(({ number }) => number === season) ?? seasons[0];
  season = current.number;
  if (rangeStart > current.episodes) rangeStart = 1;

  const episodes = listEpisodes(seasons);
  const watched = episodes.filter(({ key }) => isWatched(key)).length;
  progressCount.textContent = `${countFormat.format(watched)} of ${countFormat.format(episodes.length)} watched`;
  progressFill.style.transform = `scaleX(${watched / episodes.length})`;

  const next = episodes.find(({ key }) => !isWatched(key));
  nextButton.hidden = !next;
  doneNote.hidden = Boolean(next);
  if (next) nextButton.textContent = `Mark ${getEpisodeName(next, seasons)} watched`;
  upToLabel.textContent = seasons.length > 1 ? `Watched up to season ${season}, episode` : 'Watched up to episode';
  upToInput.max = current.episodes;

  renderSeasonTabs(seasons);
  renderRanges(current);

  const first = rangeStart;
  const last = Math.min(current.episodes, first + EPISODES_PER_RANGE - 1);
  const keys = listRange(first, last);
  const watchedHere = keys.filter(isWatched).length;
  const allWatched = watchedHere === keys.length;
  const viewName = getViewName(current, seasons, first, last);
  viewCount.hidden = episodes.length === keys.length;
  viewCount.textContent = `${watchedHere} of ${keys.length} watched in ${viewName}`;
  bulkButton.textContent = allWatched ? `Unmark ${viewName}` : `Mark ${viewName} watched`;
  bulkButton.dataset.watched = String(!allWatched);

  // Redrawing replaces the tiles, so keyboard focus goes back to the one that was pressed.
  const focused = progressGrid.contains(document.activeElement) ? document.activeElement.dataset.episode : null;
  progressGrid.replaceChildren(
    ...keys.map((key, index) => {
      const episode = first + index;
      const tile = createElement('button', 'progress__episode', String(episode));
      tile.classList.toggle('progress__episode--long', episode >= 1000);
      tile.type = 'button';
      tile.dataset.episode = episode;
      tile.setAttribute('aria-pressed', String(isWatched(key)));
      tile.setAttribute('aria-label', `Episode ${episode}${seasons.length > 1 ? `, season ${season}` : ''}`);
      return createListItem(tile);
    }),
  );
  if (focused) progressGrid.querySelector(`[data-episode="${focused}"]`)?.focus();
}

function createListItem(content) {
  const item = document.createElement('li');
  item.append(content);
  return item;
}

// Saves a batch of episodes. Bulk changes get a toast with Undo; single taps don't, to stay quiet.
function markEpisodes(keys, watched, message) {
  const changed = keys.filter((key) => isWatched(key) !== watched);
  if (!changed.length) return;
  const result = setUnits(release, changed, { watched });
  if (!result.ok) {
    showToast({ type: 'error', message: "Couldn't save your progress. Your browser storage may be full." });
    return;
  }
  if (!message) return;
  showToast({
    message: message(changed.length),
    onUndo: () => {
      if (!undo(result).ok) showToast({ type: 'error', message: "Couldn't undo. Please try again." });
    },
  });
}

const plural = (count) => `${countFormat.format(count)} episode${count === 1 ? '' : 's'}`;

function markNext() {
  const seasons = getSeasons();
  const next = listEpisodes(seasons).find(({ key }) => !isWatched(key));
  if (!next) return;
  showEpisode(next);
  markEpisodes([next.key], true);
}

// Marks every episode before this point watched, earlier seasons included. Later ones are left alone.
function markUpTo(event) {
  event.preventDefault();
  const seasons = getSeasons();
  const current = seasons.find(({ number }) => number === season);
  const episode = Math.min(Math.max(1, Math.round(Number(upToInput.value))), current.episodes);
  if (!episode) return;
  const keys = listEpisodes(seasons)
    .filter((item) => item.season < season || (item.season === season && item.episode <= episode))
    .map(({ key }) => key);
  const name = getEpisodeName({ season, episode }, seasons);
  showEpisode({ season, episode });
  upToForm.reset();
  if (keys.every(isWatched)) {
    showToast({ message: `Already watched up to ${name}` });
    renderProgress();
    return;
  }
  markEpisodes(keys, true, (count) => `Marked ${plural(count)} watched, up to ${name}`);
}

function markView() {
  const current = getSeasons().find(({ number }) => number === season);
  const last = Math.min(current.episodes, rangeStart + EPISODES_PER_RANGE - 1);
  const watched = bulkButton.dataset.watched === 'true';
  markEpisodes(listRange(rangeStart, last), watched, (count) => `${watched ? 'Marked' : 'Unmarked'} ${plural(count)}`);
}

function onEpisodeClick(event) {
  const tile = event.target.closest('.progress__episode');
  if (!tile) return;
  const episode = Number(tile.dataset.episode);
  const watched = tile.getAttribute('aria-pressed') !== 'true';

  if (event.shiftKey && anchor?.season === season && anchor.episode !== episode) {
    const first = Math.min(anchor.episode, episode);
    const last = Math.max(anchor.episode, episode);
    const verb = watched ? 'Marked' : 'Unmarked';
    markEpisodes(listRange(first, last), watched, (count) => `${verb} ${plural(count)}, ${first} to ${last}`);
  } else {
    markEpisodes([getUnitKey(season, episode)], watched);
  }
  anchor = { season, episode };
}

/* Main details */

function renderImage(container, src, alt) {
  container.classList.remove('skeleton');
  if (!src) return;
  const image = document.createElement('img');
  // The cover and backdrop are the first things on screen, so they're asked for before anything else.
  image.fetchPriority = 'high';
  image.src = src;
  image.alt = alt;
  image.addEventListener('error', () => image.remove(), { once: true });
  container.append(image);
}

function renderDescription(text) {
  about.hidden = !text;
  description.textContent = text;
  readMore.hidden = description.scrollHeight <= description.clientHeight + 1;
}

function renderFacts() {
  const rows = [
    [release.type === 'manga' ? 'Started' : 'Release date', release.tba ? 'To be announced' : formatReleaseDate(release.date)],
    ['Details', getFacts(release)],
    ['Genres', release.genres.join(', ')],
  ].filter(([, value]) => value);
  facts.replaceChildren(
    ...rows.map(([label, value]) => {
      const item = createElement('div', 'facts__item', '');
      item.append(createElement('dt', 'facts__label', label), createElement('dd', 'facts__value', value));
      return item;
    }),
  );
  providers.replaceChildren(createProviders(release));
}

// A film or show's own logo when TMDB has one and it can be shown clearly; the typed title otherwise
// (and always for screen readers, through the logo's alt text).
// The heading waits a moment for the logo, so it doesn't flash the typed title and then swap.
const LOGO_WAIT = 1200;

async function renderHeading() {
  heading.classList.add('is-waiting');
  const logo = await Promise.race([
    prepareLogo(release.logo),
    new Promise((resolve) => setTimeout(resolve, LOGO_WAIT, null)),
  ]);
  heading.replaceChildren(logo ? createLogo(logo, { className: 'title__logo', alt: release.title }) : release.title);
  heading.classList.remove('is-waiting');
}

function renderTitle() {
  document.title = `${release.title} · Drop Day`;
  hero.setAttribute('aria-busy', 'false');

  renderImage(backdrop, release.cover, '');
  cover.innerHTML = posterFallback(release.title);
  renderImage(cover, release.image, `Poster for ${release.title}`);

  eyebrow.textContent = [getTypeLabel(release), ...release.genres.slice(0, MAX_GENRES)].join(' · ');
  renderHeading();
  meta.textContent = getDateText(release);

  rating.hidden = !release.rating;
  if (release.rating) {
    rating.replaceChildren(
      createStars(release.rating),
      createElement('span', 'game__rating-value', formatRating(release.rating)),
      createElement('span', 'game__rating-source', `Community rating on ${RATING_SOURCES[release.source]}`),
    );
  }

  statusButtons.forEach((button) => {
    const label = button.querySelector('[data-status-label]');
    if (label) label.textContent = getStatusLabel(release.type, button.dataset.status);
  });
  trailerButton.hidden = !release.trailerKey;

  renderStatus();
  renderFacts();
  renderDescription(release.overview);
  renderSimilar((release.recommendations ?? []).slice(0, MAX_SIMILAR));
}

function renderSimilar(items) {
  similar.hidden = !items.length;
  similarList.replaceChildren(...items.map((item) => createShelfItem(createReleaseCard(item, { entry: getEntry(item) }))));
  updateShelfArrows(similar);
}

function showState(message) {
  [hero, yourLog, progress, about, similar].forEach((section) => {
    section.hidden = true;
  });
  stateBox.replaceChildren(message);
  stateBox.hidden = false;
}

function showNotFound() {
  document.title = 'Not found · Drop Day';
  showState(
    createStateMessage({
      headingLevel: 1,
      type: 'empty',
      title: 'Nothing found here',
      text: 'This link may be broken, or the title was removed.',
      actionLabel: 'Back to Discover',
      onAction: () => {
        location.href = 'discover.html';
      },
    }),
  );
}

async function loadTitle() {
  stateBox.hidden = true;
  hero.hidden = false;
  try {
    const details = await getDetails(request);
    if (!details) {
      showNotFound();
      return;
    }
    release = details;
    renderTitle();
    // "Log or review" in My Library links here with ?log=1 so the modal opens straight away.
    if (params.get('log') === '1') openLogModal(release, { trigger: logButton });
  } catch (error) {
    if (error.status === 404) {
      showNotFound();
      return;
    }
    showState(
      createStateMessage({
        headingLevel: 1,
        type: 'error',
        title: "This page couldn't load",
        text: 'Check your connection, then try again.',
        actionLabel: 'Retry',
        onAction: loadTitle,
      }),
    );
  }
}

async function share() {
  try {
    if (navigator.share) {
      await navigator.share({ title: release?.title ?? 'Drop Day', url: location.href });
      return;
    }
    await navigator.clipboard.writeText(location.href);
    showToast({ message: 'Link copied' });
  } catch (error) {
    if (error.name !== 'AbortError') showToast({ type: 'error', message: "Couldn't copy the link." });
  }
}

statusButtons.forEach((button) => {
  // Done opens the Log modal for a rating and review; the others save straight away. Pressing the
  // current list takes the title out again.
  button.addEventListener('click', () => {
    const { status } = button.dataset;
    if (status === getEntry(release)?.status) removeRelease(release);
    else if (status === 'done') openLogModal(release, { trigger: button, status });
    else setReleaseStatus(release, status);
  });

  button.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const shown = statusButtons.filter((item) => !item.hidden);
    const index = shown.indexOf(button);
    shown[(index + step + shown.length) % shown.length].focus();
  });
});

progressGrid.addEventListener('click', onEpisodeClick);
nextButton.addEventListener('click', markNext);
upToForm.addEventListener('submit', markUpTo);
bulkButton.addEventListener('click', markView);

progressSeasons.addEventListener('keydown', (event) => {
  const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
  if (!step) return;
  const tabs = [...progressSeasons.children];
  const index = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
  tabs[(index + step + tabs.length) % tabs.length].click();
});

remindButton.addEventListener('click', () => setReminder(release, !getEntry(release)?.remind));
removeButton.addEventListener('click', () => {
  removeRelease(release);
  statusButtons.find((button) => !button.hidden).focus();
});
shareButton.addEventListener('click', share);
logButton.addEventListener('click', () => openLogModal(release, { trigger: logButton }));
trailerButton.addEventListener('click', () => {
  openTrailerDialog({ title: release.title, trailer: { youtubeId: release.trailerKey } }, trailerButton);
});

readMore.addEventListener('click', () => {
  const expanded = readMore.getAttribute('aria-expanded') !== 'true';
  readMore.setAttribute('aria-expanded', String(expanded));
  readMore.textContent = expanded ? 'Show less' : 'Read more';
  description.classList.toggle('game__description--expanded', expanded);
});

similarList.addEventListener('release:save', (event) => toggleSave(event.detail.release));
similarList.addEventListener('release:quickview', (event) => openQuickView(event.detail.release, event.detail.trigger));

window.addEventListener('library:change', () => {
  if (release) renderStatus();
  syncCards(similarList);
});

renderBackLink();
if (SOURCES[request.source]?.includes(request.type) && /^\d+$/.test(request.id ?? '')) loadTitle();
else showNotFound();

document.querySelectorAll('.shelf').forEach(setupShelf);
