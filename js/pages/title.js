import { getEntry, setUnit } from '../store/library.js';
import { createReleaseCard, getDateText } from '../ui/card.js';
import { removeRelease, setReleaseStatus, setReminder, syncCards, toggleSave } from '../ui/library-actions.js';
import { openLogModal } from '../ui/log-modal.js';
import { posterFallback } from '../ui/poster.js';
import { createProviders, getDetails, getFacts } from '../ui/quick-view.js';
import { createStars, formatRating } from '../ui/rating.js';
import { createReview } from '../ui/review.js';
import { createShelfItem, setupShelf, updateShelfArrows } from '../ui/shelf.js';
import { createStateMessage } from '../ui/states.js';
import { showToast } from '../ui/toast.js';
import { openTrailerDialog } from '../ui/trailer-dialog.js';
import { formatReleaseDate, formatShortDate } from '../utils/dates.js';
import { getDetailUrl, getStatusesFor, getStatusLabel, getTypeLabel, isReleased } from '../utils/media.js';
import '../ui/save-feedback.js';
import '../ui/theme.js';
import '../ui/site-header.js';

// The page for a film, show, anime or manga: the same layout and Library actions as a game's page,
// with where to watch or read, episode progress and more like it.

const MAX_GENRES = 2;
const SOURCES = { tmdb: ['movie', 'tv'], anilist: ['anime', 'manga'] };
const RATING_SOURCES = { tmdb: 'TMDB', anilist: 'AniList' };
// Long-running anime (One Piece is past 1,100 episodes) would be a wall of tiles, so they come in pages.
const EPISODES_PER_PAGE = 100;

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
const progressSeasons = document.getElementById('progress-seasons');
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
let episodePage = 0;

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

/* Episode progress: one tile per episode, saved as units on the Library entry ("s2e5" for a show,
   "e12" for anime). Ticking the first one off puts the title in Watching. */

function getSeasons() {
  if (release.type === 'tv') return release.seasonList ?? [];
  // Anime: all episodes if AniList knows the count, otherwise as many as have aired.
  const aired = release.nextEpisode ? release.nextEpisode.number - 1 : 0;
  const episodes = release.episodes ?? aired;
  return episodes > 0 ? [{ number: 1, episodes }] : [];
}

function getUnitKey(episode) {
  return release.type === 'tv' ? `s${season}e${episode}` : `e${episode}`;
}

function countWatched(prefix) {
  const units = getEntry(release)?.units ?? {};
  return Object.entries(units).filter(([key, unit]) => unit.watched && key.startsWith(prefix)).length;
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
        episodePage = 0;
        renderProgress();
        progressSeasons.querySelector('[aria-selected="true"]')?.focus();
      });
      return tab;
    }),
  );
}

function renderProgress() {
  const seasons = release.type === 'tv' || release.type === 'anime' ? getSeasons() : [];
  progress.hidden = !seasons.length;
  if (progress.hidden) return;

  const current = seasons.find(({ number }) => number === season) ?? seasons[0];
  season = current.number;
  renderSeasonTabs(seasons);

  const units = getEntry(release)?.units ?? {};
  const first = episodePage * EPISODES_PER_PAGE + 1;
  const last = Math.min(current.episodes, first + EPISODES_PER_PAGE - 1);
  const tiles = [];
  for (let episode = first; episode <= last; episode += 1) {
    const watched = Boolean(units[getUnitKey(episode)]?.watched);
    const tile = createElement('button', 'progress__episode', String(episode));
    tile.type = 'button';
    tile.dataset.episode = episode;
    tile.setAttribute('aria-pressed', String(watched));
    tile.setAttribute('aria-label', `Episode ${episode}${release.type === 'tv' ? `, season ${season}` : ''}`);
    tiles.push(createListItem(tile));
  }
  if (current.episodes > last) tiles.push(createMoreButton(`Episodes ${last + 1}–${Math.min(current.episodes, last + EPISODES_PER_PAGE)}`, 1));
  if (episodePage > 0) tiles.unshift(createMoreButton(`Episodes ${Math.max(1, first - EPISODES_PER_PAGE)}–${first - 1}`, -1));
  progressGrid.replaceChildren(...tiles);

  const prefix = release.type === 'tv' ? `s${season}e` : 'e';
  const label = release.type === 'tv' && seasons.length > 1 ? ` in season ${season}` : '';
  progressCount.textContent = `${countWatched(prefix)} of ${current.episodes} watched${label}`;
}

function createListItem(content) {
  const item = document.createElement('li');
  item.append(content);
  return item;
}

function createMoreButton(text, step) {
  const button = createElement('button', 'text-button progress__more', text);
  button.type = 'button';
  button.addEventListener('click', () => {
    episodePage += step;
    renderProgress();
  });
  return createListItem(button);
}

function toggleEpisode(episode) {
  const key = getUnitKey(episode);
  const watched = !getEntry(release)?.units?.[key]?.watched;
  const result = setUnit(release, key, { watched });
  if (!result.ok) showToast({ type: 'error', message: "Couldn't save your progress. Your browser storage may be full." });
}

/* Main details */

function renderImage(container, src, alt) {
  container.classList.remove('skeleton');
  if (!src) return;
  const image = document.createElement('img');
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

// A film or show's own logo when TMDB has one; the typed title otherwise (and always for screen readers).
function renderHeading() {
  if (!release.logo) {
    heading.textContent = release.title;
    return;
  }
  const logo = document.createElement('img');
  logo.className = 'title__logo';
  logo.src = release.logo;
  logo.alt = release.title;
  logo.addEventListener('error', () => {
    heading.textContent = release.title;
  });
  heading.replaceChildren(logo);
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
  renderSimilar(release.recommendations ?? []);
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

progressGrid.addEventListener('click', (event) => {
  const tile = event.target.closest('.progress__episode');
  if (tile) toggleEpisode(Number(tile.dataset.episode));
});

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
// From one title page, a similar title opens its own page rather than a drawer.
similarList.addEventListener('release:quickview', (event) => {
  location.href = getDetailUrl(event.detail.release);
});

window.addEventListener('library:change', () => {
  if (release) renderStatus();
  syncCards(similarList);
});

renderBackLink();
if (SOURCES[request.source]?.includes(request.type) && /^\d+$/.test(request.id ?? '')) loadTitle();
else showNotFound();

document.querySelectorAll('.shelf').forEach(setupShelf);
