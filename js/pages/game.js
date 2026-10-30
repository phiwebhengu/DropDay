import * as rawg from '../api/rawg.js';
import { getEntry } from '../store/library.js';
import { createReleaseCard, getDateText } from '../ui/card.js';
import { removeRelease, setReleaseStatus, setReminder, syncCards, toggleSave } from '../ui/library-actions.js';
import { openLogModal } from '../ui/log-modal.js';
import { posterFallback } from '../ui/poster.js';
import { createStars, formatRating } from '../ui/rating.js';
import { createReview } from '../ui/review.js';
import { createShelfItem, setupShelf, updateShelfArrows } from '../ui/shelf.js';
import { createStateMessage } from '../ui/states.js';
import { showToast } from '../ui/toast.js';
import { formatReleaseDate, formatShortDate } from '../utils/dates.js';
import { getStatusLabel, isReleased } from '../utils/media.js';
import '../ui/immersive-header.js';
import '../ui/save-feedback.js';
import '../ui/theme.js';

const RETURN_KEY = 'dropday.discover.return';
const MAX_GENRES = 2;
const STANDARD_EDITION = 'Standard edition';

const SIMILAR_COUNT = 12;

const backLink = document.getElementById('back-link');
const backLinkText = document.getElementById('back-link-text');
const stateBox = document.getElementById('game-state');
const hero = document.getElementById('game-hero');
const backdrop = document.getElementById('game-backdrop');
const cover = document.getElementById('game-cover');
const facts = document.getElementById('game-facts');
const eyebrow = document.getElementById('game-eyebrow');
const title = document.getElementById('game-title');
const meta = document.getElementById('game-meta');
const platforms = document.getElementById('game-platforms');
const rating = document.getElementById('game-rating');
const statusButtons = [...document.querySelectorAll('.status-button')];
const logButton = document.getElementById('log-button');
const shareButton = document.getElementById('share-button');
const removeButton = document.getElementById('remove-button');
const remindButton = document.getElementById('remind-button');
const yourLog = document.getElementById('your-log');
const yourLogCard = document.getElementById('your-log-card');
const about = document.getElementById('game-about');
const description = document.getElementById('game-description');
const readMore = document.getElementById('read-more');
const screenshots = document.getElementById('game-screenshots');
const screenshotList = document.getElementById('screenshots-list');
const similar = document.getElementById('game-similar');
const similarList = document.getElementById('similar-list');
const similarSeeAll = document.getElementById('similar-see-all');

const id = new URLSearchParams(location.search).get('id');
let game = null;

function readReturnLink() {
  try {
    return JSON.parse(sessionStorage.getItem(RETURN_KEY));
  } catch {
    return null;
  }
}

// Coming from Discover, Back keeps the user's filters, loaded cards and scroll (see discover.js).
// The page this game was opened from, if it's one of ours ("" for Home).
function getPreviousPage() {
  if (!document.referrer) return null;
  const from = new URL(document.referrer);
  return from.origin === location.origin ? { name: from.pathname.split('/').pop(), search: from.search } : null;
}

// Back goes to wherever the user came from. From Discover it keeps their filters, loaded cards and
// scroll (see discover.js); history.back() is used when possible so the browser restores the scroll too.
function renderBackLink() {
  const previous = getPreviousPage();
  const saved = readReturnLink();

  if (previous?.name === 'library.html') {
    backLink.href = `library.html${previous.search}`;
    backLinkText.textContent = 'Back to My Library';
  } else if (previous?.name === 'index.html' || previous?.name === '') {
    backLink.href = 'index.html';
    backLinkText.textContent = 'Back to Home';
  } else if (saved) {
    backLink.href = `discover.html${saved.search}`;
    backLinkText.textContent = saved.label ? `Back to results · ${saved.label}` : 'Back to results';
  }

  const goesToPrevious = previous && backLink.pathname === new URL(document.referrer).pathname;
  backLink.addEventListener('click', (event) => {
    if (!goesToPrevious || history.length < 2) return;
    event.preventDefault();
    history.back();
  });
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function renderStatus() {
  const status = getEntry(game)?.status ?? null;
  // Roving tabindex: Tab lands on the chosen status (or the first), arrow keys move within the group.
  const focusable = status ?? statusButtons[0].dataset.status;
  statusButtons.forEach((button) => {
    button.disabled = false;
    button.setAttribute('aria-checked', String(button.dataset.status === status));
    button.tabIndex = button.dataset.status === focusable ? 0 : -1;
  });
  removeButton.hidden = !status;
  logButton.disabled = false;
  logButton.textContent = getEntry(game)?.loggedAt ? 'Edit your log' : 'Log or review';

  // A reminder only makes sense before release day.
  const remind = Boolean(getEntry(game)?.remind);
  remindButton.hidden = isReleased(game);
  remindButton.setAttribute('aria-pressed', String(remind));
  remindButton.textContent = remind ? '🔔 Reminder on' : '🔔 Remind me';
  renderYourLog();
}

// What the user logged, shown like a Letterboxd review: rating, when and how they played, and their words.
function renderYourLog() {
  const entry = getEntry(game);
  yourLog.hidden = !entry?.loggedAt;
  if (yourLog.hidden) return;

  const details = [
    getStatusLabel(game.type, entry.status),
    `Logged ${formatShortDate(entry.loggedAt)}`,
    entry.platform,
    entry.edition !== STANDARD_EDITION ? entry.edition : null,
  ];
  const meta = createElement('p', 'your-log__meta', details.filter(Boolean).join(' · '));

  const parts = [meta];
  if (entry.rating) {
    const rating = createElement('p', 'your-log__rating', '');
    rating.append(createStars(entry.rating), createElement('span', 'your-log__rating-value', formatRating(entry.rating)));
    parts.unshift(rating);
  }
  if (entry.review) parts.push(createReview(entry.review, { spoilers: entry.spoilers }));
  else parts.push(createElement('p', 'your-log__empty', 'No review written. Add a few words any time.'));

  yourLogCard.replaceChildren(...parts);
}

function renderDescription(text) {
  about.hidden = !text;
  description.textContent = text;
  // Only offer "Read more" when the clamp actually hides something.
  readMore.hidden = description.scrollHeight <= description.clientHeight + 1;
}

function renderImage(container, src, alt) {
  container.classList.remove('skeleton');
  if (!src) return;
  const image = document.createElement('img');
  image.src = src;
  image.alt = alt;
  image.addEventListener('error', () => image.remove(), { once: true });
  container.append(image);
}

// Label and value pairs; anything RAWG doesn't know is left out rather than shown as "Unknown".
function renderFacts() {
  const rows = [
    ['Release date', game.tba ? 'To be announced' : formatReleaseDate(game.date)],
    ['Developer', game.developers.join(', ')],
    ['Publisher', game.publishers.join(', ')],
    ['Genres', game.genres.join(', ')],
  ].filter(([, value]) => value);
  facts.replaceChildren(
    ...rows.map(([label, value]) => {
      const item = createElement('div', 'facts__item', '');
      item.append(createElement('dt', 'facts__label', label), createElement('dd', 'facts__value', value));
      return item;
    }),
  );
}

function renderGame() {
  document.title = `${game.title} · Drop Day`;
  hero.setAttribute('aria-busy', 'false');

  // The wide key art fills the backdrop; the official cover (when IGDB has one) is the poster beside the title.
  renderImage(backdrop, game.cover, '');
  cover.innerHTML = posterFallback(game.title);
  renderImage(cover, game.poster ?? game.cover, `Cover art for ${game.title}`);
  // Every game page keeps the same layout: without an official cover, the key art becomes the poster.
  if (!game.poster && game.cover) {
    const coverTitle = createElement('span', 'game__cover-title', game.title);
    coverTitle.setAttribute('aria-hidden', 'true');
    cover.append(coverTitle);
  }

  eyebrow.textContent = ['Game', ...game.genres.slice(0, MAX_GENRES)].join(' · ');
  title.textContent = game.title;
  meta.textContent = [getDateText(game), game.developers[0]].filter(Boolean).join(' · ');
  platforms.replaceChildren(...game.platforms.map((name) => createElement('li', 'tag', name)));

  rating.hidden = !game.rating;
  if (game.rating) {
    rating.replaceChildren(
      createStars(game.rating),
      createElement('span', 'game__rating-value', formatRating(game.rating)),
      createElement('span', 'game__rating-source', 'Community rating on RAWG'),
    );
  }

  renderStatus();
  renderFacts();
  renderDescription(game.description);
}

function renderScreenshots(urls) {
  screenshots.hidden = !urls.length;
  screenshotList.replaceChildren(
    ...urls.map((url, index) => {
      const image = document.createElement('img');
      image.className = 'screenshots__image';
      image.src = url;
      image.alt = `Screenshot ${index + 1} of ${game.title}`;
      image.width = 600;
      image.height = 338;
      image.loading = 'lazy';
      image.decoding = 'async';
      // If every screenshot fails, the section goes too, rather than leaving a heading over nothing.
      const item = createShelfItem(image);
      image.addEventListener(
        'error',
        () => {
          item.remove();
          screenshots.hidden = !screenshotList.children.length;
        },
        { once: true },
      );
      return item;
    }),
  );
  updateShelfArrows(screenshots);
}

function renderSimilar(games) {
  similar.hidden = !games.length;
  similarSeeAll.href = `discover.html?cat=games&range=quarter&genre=${game.genreIds[0]}`;
  similarList.replaceChildren(...games.map((release) => createShelfItem(createReleaseCard(release, { entry: getEntry(release) }))));
  updateShelfArrows(similar);
}

// The extras load after the main details so the page is usable sooner; if they fail, their sections just stay hidden.
function loadExtras() {
  rawg.getScreenshots(id).then(renderScreenshots).catch(() => {});
  rawg.getSimilarGames(id, game.genreIds, SIMILAR_COUNT).then(renderSimilar).catch(() => {});
}

function showState(message) {
  hero.hidden = true;
  yourLog.hidden = true;
  about.hidden = true;
  screenshots.hidden = true;
  similar.hidden = true;
  stateBox.replaceChildren(message);
  stateBox.hidden = false;
}

function showNotFound() {
  document.title = 'Game not found · Drop Day';
  showState(
    createStateMessage({
      headingLevel: 1,
      type: 'empty',
      title: 'Game not found',
      text: 'This link may be broken, or the game was removed from RAWG.',
      actionLabel: 'Back to Discover',
      onAction: () => {
        location.href = 'discover.html';
      },
    }),
  );
}

async function loadGame() {
  stateBox.hidden = true;
  hero.hidden = false;
  try {
    ({ game } = await rawg.getGame(id));
    if (!game) {
      showNotFound();
      return;
    }
    renderGame();
    loadExtras();
    // "Edit log" in My Library links here with ?log=1 so the modal opens straight away.
    if (new URLSearchParams(location.search).get('log') === '1') openLogModal(game, { trigger: logButton });
  } catch (error) {
    if (error.status === 404) {
      showNotFound();
      return;
    }
    showState(
      createStateMessage({
        headingLevel: 1,
        type: 'error',
        title: "This game couldn't load",
        text: 'Check your connection, then try again.',
        actionLabel: 'Retry',
        onAction: loadGame,
      }),
    );
  }
}

async function share() {
  const url = location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: game?.title ?? 'Drop Day', url });
      return;
    }
    await navigator.clipboard.writeText(url);
    showToast({ message: 'Link copied' });
  } catch (error) {
    if (error.name !== 'AbortError') showToast({ type: 'error', message: "Couldn't copy the link." });
  }
}

statusButtons.forEach((button, index) => {
  // Done opens the Log modal for a rating and review; the others save straight away. Pressing the
  // list a game is already in takes it out again, which is what testers expected that tap to do.
  button.addEventListener('click', () => {
    const { status } = button.dataset;
    if (status === getEntry(game)?.status) removeRelease(game);
    else if (status === 'done') openLogModal(game, { trigger: button, status });
    else setReleaseStatus(game, status);
  });

  button.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    statusButtons[(index + step + statusButtons.length) % statusButtons.length].focus();
  });
});

remindButton.addEventListener('click', () => setReminder(game, !getEntry(game)?.remind));

removeButton.addEventListener('click', () => {
  removeRelease(game);
  statusButtons[0].focus();
});

shareButton.addEventListener('click', share);
logButton.addEventListener('click', () => openLogModal(game, { trigger: logButton }));

readMore.addEventListener('click', () => {
  const expanded = readMore.getAttribute('aria-expanded') !== 'true';
  readMore.setAttribute('aria-expanded', String(expanded));
  readMore.textContent = expanded ? 'Show less' : 'Read more';
  description.classList.toggle('game__description--expanded', expanded);
});

similarList.addEventListener('release:save', (event) => toggleSave(event.detail.release));

window.addEventListener('library:change', () => {
  if (game) renderStatus();
  syncCards(similarList);
});

renderBackLink();
if (/^\d+$/.test(id ?? '')) loadGame();
else showNotFound();

document.querySelectorAll('.shelf').forEach(setupShelf);
