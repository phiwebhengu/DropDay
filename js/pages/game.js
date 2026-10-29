import * as rawg from '../api/rawg.js';
import { getEntry, getStatus } from '../store/library.js';
import { createReleaseCard, getDateText } from '../ui/card.js';
import { removeRelease, setReleaseStatus, syncCards, toggleSave } from '../ui/library-actions.js';
import { openLogModal } from '../ui/log-modal.js';
import { posterFallback } from '../ui/poster.js';
import { createStars, formatRating } from '../ui/rating.js';
import { createReview } from '../ui/review.js';
import { createStateMessage } from '../ui/states.js';
import { showToast } from '../ui/toast.js';
import { formatShortDate } from '../utils/dates.js';
import '../ui/save-feedback.js';
import '../ui/theme.js';

const RETURN_KEY = 'dropday.discover.return';
const MAX_GENRES = 2;
const STANDARD_EDITION = 'Standard edition';

const LOG_STATUS_NAMES = {
  played: 'Played',
  playing: 'Playing',
};
const SIMILAR_COUNT = 5;

const backLink = document.getElementById('back-link');
const backLinkText = document.getElementById('back-link-text');
const stateBox = document.getElementById('game-state');
const hero = document.getElementById('game-hero');
const cover = document.getElementById('game-cover');
const eyebrow = document.getElementById('game-eyebrow');
const title = document.getElementById('game-title');
const meta = document.getElementById('game-meta');
const platforms = document.getElementById('game-platforms');
const rating = document.getElementById('game-rating');
const statusButtons = [...document.querySelectorAll('.status-button')];
const logButton = document.getElementById('log-button');
const shareButton = document.getElementById('share-button');
const removeButton = document.getElementById('remove-button');
const yourLog = document.getElementById('your-log');
const yourLogCard = document.getElementById('your-log-card');
const about = document.getElementById('game-about');
const description = document.getElementById('game-description');
const readMore = document.getElementById('read-more');
const screenshots = document.getElementById('game-screenshots');
const screenshotList = document.getElementById('screenshot-list');
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
  const status = getStatus(game);
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
  renderYourLog();
}

// What the user logged, shown like a Letterboxd review: rating, when and how they played, and their words.
function renderYourLog() {
  const entry = getEntry(game);
  yourLog.hidden = !entry?.loggedAt;
  if (yourLog.hidden) return;

  const details = [
    LOG_STATUS_NAMES[entry.status],
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

function renderGame() {
  document.title = `${game.title} · Drop Day`;
  hero.setAttribute('aria-busy', 'false');

  cover.classList.remove('skeleton');
  cover.innerHTML = posterFallback(game.title);
  if (game.cover) {
    const image = document.createElement('img');
    image.className = 'game__cover-image';
    image.src = game.cover;
    image.alt = `Cover art for ${game.title}`;
    image.addEventListener('error', () => image.remove(), { once: true });
    cover.append(image);
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
  renderDescription(game.description);
}

function renderScreenshots(urls) {
  screenshots.hidden = !urls.length;
  screenshotList.replaceChildren(
    ...urls.map((url, index) => {
      const item = document.createElement('li');
      const image = document.createElement('img');
      image.className = 'screenshots__image';
      image.src = url;
      image.alt = `Screenshot ${index + 1} of ${game.title}`;
      image.width = 600;
      image.height = 338;
      image.loading = 'lazy';
      image.decoding = 'async';
      // If every screenshot fails, the section goes too, rather than leaving a heading over nothing.
      image.addEventListener(
        'error',
        () => {
          item.remove();
          screenshots.hidden = !screenshotList.children.length;
        },
        { once: true },
      );
      item.append(image);
      return item;
    }),
  );
}

function renderSimilar(games) {
  similar.hidden = !games.length;
  similarSeeAll.href = `discover.html?cat=games&range=quarter&genre=${game.genreIds[0]}`;
  similarList.replaceChildren(
    ...games.map((release) => {
      const item = document.createElement('li');
      item.append(createReleaseCard(release, { status: getStatus(release) }));
      return item;
    }),
  );
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
  // Played and Playing open the Log modal set to that status; Backlog and Radar save straight away (Figma note 9).
  button.addEventListener('click', () => {
    const { status } = button.dataset;
    if (status === 'played' || status === 'playing') openLogModal(game, { trigger: button, status });
    else setReleaseStatus(game, status);
  });

  button.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    statusButtons[(index + step + statusButtons.length) % statusButtons.length].focus();
  });
});

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
