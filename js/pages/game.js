import * as rawg from '../api/rawg.js';
import { getStatus } from '../store/library.js';
import { getDateText } from '../ui/card.js';
import { removeRelease, setReleaseStatus } from '../ui/library-actions.js';
import { createStars, formatRating } from '../ui/rating.js';
import { createStateMessage } from '../ui/states.js';
import { showToast } from '../ui/toast.js';

const RETURN_KEY = 'dropday.discover.return';
const MAX_GENRES = 2;

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
const shareButton = document.getElementById('share-button');
const removeButton = document.getElementById('remove-button');
const about = document.getElementById('game-about');
const description = document.getElementById('game-description');
const readMore = document.getElementById('read-more');

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
function renderBackLink() {
  const saved = readReturnLink();
  if (!saved) return;
  backLink.href = `discover.html${saved.search}`;
  backLinkText.textContent = saved.label ? `Back to results · ${saved.label}` : 'Back to results';

  const cameFromDiscover = document.referrer && new URL(document.referrer).pathname.endsWith('/discover.html');
  backLink.addEventListener('click', (event) => {
    if (!cameFromDiscover || history.length < 2) return;
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
  cover.replaceChildren();
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

function showState(message) {
  hero.hidden = true;
  about.hidden = true;
  stateBox.replaceChildren(message);
  stateBox.hidden = false;
}

function showNotFound() {
  document.title = 'Game not found · Drop Day';
  showState(
    createStateMessage({
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
    renderGame();
  } catch (error) {
    if (error.status === 404) {
      showNotFound();
      return;
    }
    showState(
      createStateMessage({
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
  button.addEventListener('click', () => setReleaseStatus(game, button.dataset.status));

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

readMore.addEventListener('click', () => {
  const expanded = readMore.getAttribute('aria-expanded') !== 'true';
  readMore.setAttribute('aria-expanded', String(expanded));
  readMore.textContent = expanded ? 'Show less' : 'Read more';
  description.classList.toggle('game__description--expanded', expanded);
});

window.addEventListener('library:change', () => {
  if (game) renderStatus();
});

renderBackLink();
if (/^\d+$/.test(id ?? '')) loadGame();
else showNotFound();
