import * as tmdb from '../api/tmdb.js';
import { getDateText, getSaveText } from './card.js';
import { createStateMessage } from './states.js';

const CATEGORY_LABELS = {
  movie: 'Movie',
  tv: 'TV',
  anime: 'Anime',
};

let dialog;
let opener;
let current;
let requestId = 0;

function formatRuntime(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function getFacts(details) {
  if (details.runtime) return formatRuntime(details.runtime);
  if (details.seasons) return details.seasons === 1 ? '1 season' : `${details.seasons} seasons`;
  return '';
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

// Built once and reused, so every page that shows movie, TV or anime cards gets the same drawer.
function createDialog() {
  const element = document.createElement('dialog');
  element.className = 'quick-view';
  element.setAttribute('aria-labelledby', 'quick-view-title');
  element.innerHTML = `
    <div class="quick-view__panel">
      <span class="quick-view__handle" aria-hidden="true"></span>
      <div class="quick-view__top">
        <p class="quick-view__category"></p>
        <button class="quick-view__close" type="button" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div class="quick-view__intro">
        <div class="quick-view__poster"></div>
        <div class="quick-view__heading">
          <h2 class="quick-view__title" id="quick-view-title"></h2>
          <p class="quick-view__date"></p>
          <p class="quick-view__facts"></p>
        </div>
      </div>
      <div class="quick-view__actions">
        <button class="button button--primary quick-view__save" type="button" aria-pressed="false"></button>
        <button class="button button--outline quick-view__trailer-button" type="button" hidden>Watch trailer</button>
      </div>
      <div class="quick-view__trailer" hidden></div>
      <div class="quick-view__details" aria-live="polite"></div>
    </div>
  `;
  document.body.append(element);

  element.querySelector('.quick-view__close').addEventListener('click', () => element.close());

  // A click on the dialog itself (not the panel inside it) is a click on the backdrop.
  element.addEventListener('click', (event) => {
    if (event.target === element) element.close();
  });

  element.addEventListener('close', () => {
    requestId += 1;
    element.querySelector('.quick-view__trailer').replaceChildren();
    opener?.focus();
  });

  element.querySelector('.quick-view__save').addEventListener('click', toggleSave);
  element.querySelector('.quick-view__trailer-button').addEventListener('click', playTrailer);

  return element;
}

// Saving to the Library arrives in #16; for now the button reports the change for the page to handle.
function toggleSave() {
  const button = dialog.querySelector('.quick-view__save');
  const saved = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(saved));
  button.textContent = getSaveText(current.type, saved);
  dialog.dispatchEvent(new CustomEvent('release:save', { bubbles: true, detail: { release: current, saved } }));
}

// The video only loads when asked for, which saves data and keeps sound from starting by surprise.
function playTrailer() {
  const slot = dialog.querySelector('.quick-view__trailer');
  const frame = document.createElement('iframe');
  frame.className = 'quick-view__video';
  frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(current.trailerKey)}?autoplay=1&rel=0`;
  frame.title = `${current.title} trailer`;
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  slot.replaceChildren(frame);
  slot.hidden = false;
  dialog.querySelector('.quick-view__trailer-button').hidden = true;
}

function renderIntro(release) {
  dialog.dataset.type = release.type;
  dialog.querySelector('.quick-view__category').textContent = CATEGORY_LABELS[release.type];
  dialog.querySelector('.quick-view__title').textContent = release.title;
  dialog.querySelector('.quick-view__date').textContent = getDateText(release);
  dialog.querySelector('.quick-view__facts').textContent = '';

  const poster = dialog.querySelector('.quick-view__poster');
  poster.replaceChildren();
  if (release.image) {
    const image = createElement('img', 'quick-view__image');
    image.src = release.image;
    image.alt = '';
    image.addEventListener('error', () => image.remove(), { once: true });
    poster.append(image);
  }

  const save = dialog.querySelector('.quick-view__save');
  save.setAttribute('aria-pressed', 'false');
  save.textContent = getSaveText(release.type, false);

  dialog.querySelector('.quick-view__trailer-button').hidden = true;
  const trailer = dialog.querySelector('.quick-view__trailer');
  trailer.replaceChildren();
  trailer.hidden = true;
}

function renderLoading() {
  const details = dialog.querySelector('.quick-view__details');
  details.setAttribute('aria-busy', 'true');
  details.innerHTML = `
    <span class="skeleton skeleton--line"></span>
    <span class="skeleton skeleton--line"></span>
    <span class="skeleton skeleton--line skeleton--short"></span>
  `;
}

function createSection(title) {
  const section = createElement('section', 'quick-view__section');
  section.append(createElement('h3', 'quick-view__section-title', title));
  return section;
}

function createProviders(providers) {
  const section = createSection('Where to watch in South Africa');
  if (!providers.length) {
    section.append(createElement('p', 'quick-view__muted', 'Not streaming in South Africa yet.'));
    return section;
  }

  const list = createElement('ul', 'quick-view__providers');
  list.setAttribute('role', 'list');
  providers.forEach(({ name, logo }) => {
    const item = createElement('li', 'quick-view__provider');
    if (logo) {
      const image = createElement('img', 'quick-view__provider-logo');
      image.src = logo;
      image.alt = '';
      image.width = 32;
      image.height = 32;
      item.append(image);
    }
    item.append(createElement('span', '', name));
    list.append(item);
  });

  // TMDB's terms ask for JustWatch to be credited wherever provider data is shown.
  section.append(list, createElement('p', 'quick-view__credit', 'Streaming data from JustWatch'));
  return section;
}

function renderDetails(details) {
  dialog.querySelector('.quick-view__facts').textContent = getFacts(details);
  dialog.querySelector('.quick-view__trailer-button').hidden = !details.trailerKey;

  const about = createSection('About');
  about.append(createElement('p', 'quick-view__overview', details.overview || 'No description yet.'));

  const container = dialog.querySelector('.quick-view__details');
  container.replaceChildren(about, createProviders(details.providers));
  container.setAttribute('aria-busy', 'false');
}

function renderError(release) {
  const container = dialog.querySelector('.quick-view__details');
  container.setAttribute('aria-busy', 'false');
  container.replaceChildren(
    createStateMessage({
      type: 'error',
      title: "Details couldn't load",
      text: 'Check your connection, then try again.',
      actionLabel: 'Retry',
      onAction: () => loadDetails(release),
    }),
  );
}

async function loadDetails(release) {
  const id = ++requestId;
  renderLoading();
  try {
    const details = release.type === 'movie' ? await tmdb.getMovie(release.id) : await tmdb.getShow(release.id, release.type);
    if (id !== requestId) return;
    current = { ...release, ...details, date: release.date, season: release.season };
    renderDetails(details);
  } catch {
    if (id === requestId) renderError(release);
  }
}

// The card already has the title, date and poster, so those show straight away while the rest loads.
export function openQuickView(release, trigger) {
  dialog ??= createDialog();
  opener = trigger;
  current = release;
  renderIntro(release);
  dialog.showModal();
  dialog.querySelector('.quick-view__panel').scrollTop = 0;
  loadDetails(release);
}
