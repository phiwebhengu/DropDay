import * as anilist from '../api/anilist.js';
import * as tmdb from '../api/tmdb.js';
import { getDateText, getSaveText } from './card.js';
import { posterFallback } from './poster.js';
import { createStateMessage } from './states.js';
import { getEntry } from '../store/library.js';
import { toggleSave } from './library-actions.js';
import { closeDialog, openDialog } from '../motion.js';
import { formatShortDate } from '../utils/dates.js';
import { getTypeLabel } from '../utils/media.js';

let dialog;
let opener;
let current;
let requestId = 0;
let closing = false;

// A bottom sheet on phones, a drawer from the right from 1024 px.
function getOrigin() {
  return window.matchMedia('(min-width: 1024px)').matches ? 'right' : 'bottom';
}

async function closeDrawer() {
  if (closing || !dialog.open) return;
  closing = true;
  await closeDialog(dialog, getOrigin());
  dialog.close();
  closing = false;
}

function formatRuntime(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function count(number, word) {
  return `${number} ${word}${number === 1 ? '' : 's'}`;
}

function getFacts(details) {
  const facts = [];
  if (details.runtime) facts.push(formatRuntime(details.runtime));
  if (details.seasons) facts.push(count(details.seasons, 'season'));
  if (details.episodes) facts.push(count(details.episodes, 'episode'));
  if (details.chapters) facts.push(count(details.chapters, 'chapter'));
  else if (details.type === 'manga' && details.status === 'RELEASING') facts.push('Ongoing');
  if (details.volumes) facts.push(count(details.volumes, 'volume'));
  if (details.nextEpisode) {
    facts.push(`Episode ${details.nextEpisode.number} out ${formatShortDate(details.nextEpisode.at)}`);
  }
  if (details.studios?.length) facts.push(details.studios[0]);
  return facts.join(' · ');
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
      <div class="quick-view__intro" data-reveal>
        <div class="quick-view__poster"></div>
        <div class="quick-view__heading">
          <h2 class="quick-view__title" id="quick-view-title"></h2>
          <p class="quick-view__date"></p>
          <p class="quick-view__facts"></p>
        </div>
      </div>
      <div class="quick-view__actions" data-reveal>
        <button class="button button--primary quick-view__save" type="button" aria-pressed="false"></button>
        <button class="button button--outline quick-view__trailer-button" type="button" hidden>Watch trailer</button>
      </div>
      <div class="quick-view__trailer" hidden></div>
      <div class="quick-view__details" aria-live="polite" data-reveal></div>
    </div>
    <div class="toast-region" role="status" aria-live="polite"></div>
  `;
  document.body.append(element);

  element.querySelector('.quick-view__close').addEventListener('click', closeDrawer);

  // A click on the dialog itself (not the panel inside it) is a click on the backdrop.
  element.addEventListener('click', (event) => {
    if (event.target === element) closeDrawer();
  });

  element.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDrawer();
  });

  element.addEventListener('close', () => {
    requestId += 1;
    element.querySelector('.quick-view__trailer').replaceChildren();
    opener?.focus();
  });

  element.querySelector('.quick-view__save').addEventListener('click', () => toggleSave(current));
  window.addEventListener('library:change', () => {
    if (element.open) renderSaveButton();
  });
  element.querySelector('.quick-view__trailer-button').addEventListener('click', playTrailer);

  return element;
}

function renderSaveButton() {
  const button = dialog.querySelector('.quick-view__save');
  const entry = getEntry(current);
  button.setAttribute('aria-pressed', String(Boolean(entry)));
  button.textContent = getSaveText(current, entry);
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
  dialog.querySelector('.quick-view__category').textContent = getTypeLabel(release);
  dialog.querySelector('.quick-view__title').textContent = release.title;
  dialog.querySelector('.quick-view__date').textContent = getDateText(release);
  dialog.querySelector('.quick-view__facts').textContent = '';

  const poster = dialog.querySelector('.quick-view__poster');
  poster.innerHTML = posterFallback(release.title);
  if (release.image) {
    const image = createElement('img', 'quick-view__image');
    image.src = release.image;
    image.alt = '';
    image.addEventListener('error', () => image.remove(), { once: true });
    poster.append(image);
  }

  renderSaveButton();

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

// TMDB lists South African streaming services; AniList lists official sites worldwide, as links.
function createProviders({ source, type, providers }) {
  const fromAniList = source === 'anilist';
  const verb = type === 'manga' ? 'read' : 'watch';
  const section = createSection(fromAniList ? `Where to ${verb}` : 'Where to watch in South Africa');
  if (!providers.length) {
    const empty = fromAniList ? `No official ${verb === 'read' ? 'reading' : 'streaming'} links yet.` : 'Not streaming in South Africa yet.';
    section.append(createElement('p', 'quick-view__muted', empty));
    return section;
  }

  const list = createElement('ul', 'quick-view__providers');
  list.setAttribute('role', 'list');
  providers.forEach(({ name, logo, url }) => {
    const item = createElement('li', 'quick-view__provider');
    if (logo) {
      const image = createElement('img', 'quick-view__provider-logo');
      image.src = logo;
      image.alt = '';
      image.width = 32;
      image.height = 32;
      item.append(image);
    }
    if (url) {
      const link = createElement('a', 'quick-view__provider-link', name);
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.append(createElement('span', 'visually-hidden', ' (opens in a new tab)'));
      item.append(link);
    } else {
      item.append(createElement('span', '', name));
    }
    list.append(item);
  });

  // TMDB's terms ask for JustWatch to be credited wherever provider data is shown.
  const credit = fromAniList ? 'Links from AniList' : 'Streaming data from JustWatch';
  section.append(list, createElement('p', 'quick-view__credit', credit));
  return section;
}

function renderDetails(details) {
  dialog.querySelector('.quick-view__facts').textContent = getFacts(details);
  dialog.querySelector('.quick-view__trailer-button').hidden = !details.trailerKey;

  const about = createSection('About');
  about.append(createElement('p', 'quick-view__overview', details.overview || 'No description yet.'));

  const container = dialog.querySelector('.quick-view__details');
  container.replaceChildren(about, createProviders(details));
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

function getDetails({ source, type, id }) {
  if (source === 'anilist') return anilist.getMedia(id);
  return type === 'movie' ? tmdb.getMovie(id) : tmdb.getShow(id, type);
}

async function loadDetails(release) {
  const id = ++requestId;
  renderLoading();
  try {
    const details = await getDetails(release);
    if (id !== requestId) return;
    if (!details) throw new Error('Not available');
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
  openDialog(dialog, getOrigin());
  dialog.querySelector('.quick-view__panel').scrollTop = 0;
  loadDetails(release);
}
