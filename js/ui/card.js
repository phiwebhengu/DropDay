import { formatReleaseDate, toIsoDate } from '../utils/dates.js';
import { escapeHtml } from '../utils/html.js';
import { getStatusLabel, getTypeLabel, isReleased } from '../utils/media.js';
import { posterFallback } from './poster.js';

const MAX_PLATFORMS = 3;

const DATE_PREFIXES = {
  game: 'Releases',
  movie: 'In cinemas',
  tv: 'Premieres',
  anime: 'Streams',
  manga: 'Starts',
};

const PLATFORM_NAMES = {
  'Xbox Series S/X': 'Xbox',
  'PlayStation 5': 'PS5',
  'PlayStation 4': 'PS4',
  'Nintendo Switch': 'Switch',
};

const PAST_PREFIXES = {
  game: 'Released',
  movie: 'Released',
  tv: 'Premiered',
  anime: 'Premiered',
  manga: 'Started',
};

export function getDateText({ type, date, tba, season, status }) {
  if (tba) return 'Release date TBA';

  const today = toIsoDate(new Date());
  // A manga that's still coming out matters more than the day its first chapter appeared.
  if (type === 'manga' && status === 'RELEASING' && date <= today) return `Ongoing since ${date.slice(0, 4)}`;
  if (date === today) return season > 1 ? `Season ${season} out today` : 'Out today';

  const isPast = date < today;
  if (season > 1) return `Season ${season} ${isPast ? 'premiered' : 'premieres'} ${formatReleaseDate(date)}`;

  const prefix = isPast ? PAST_PREFIXES[type] : DATE_PREFIXES[type];
  return `${prefix} ${formatReleaseDate(date)}`;
}

function getPlatforms({ platforms }) {
  const names = platforms.map((name) => PLATFORM_NAMES[name] ?? name);
  const extra = names.length - MAX_PLATFORMS;
  return (extra > 0 ? [...names.slice(0, MAX_PLATFORMS), `+${extra}`] : names).join(', ');
}

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  bell: '<path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16zM10 20a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  bellOn: '<path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16zM10 20a2 2 0 0 0 4 0" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
};

const SYMBOLS = { plus: '+', check: '✓', bell: '🔔', bellOn: '🔔' };

// entry is the item's Library entry, or null when it isn't saved. Upcoming releases offer a reminder;
// released ones go straight to Want to.
function getSaveState(release, entry) {
  if (entry?.status === 'want' && entry.remind) return { icon: 'bellOn', label: 'Reminder on' };
  if (entry) return { icon: 'check', label: getStatusLabel(release.type, entry.status) };
  if (isReleased(release)) return { icon: 'plus', label: getStatusLabel(release.type, 'want') };
  return { icon: 'bell', label: 'Remind me' };
}

export function getSaveText(release, entry) {
  const { icon, label } = getSaveState(release, entry);
  return `${SYMBOLS[icon]} ${label}`;
}

function renderSaveButton(release, entry) {
  const { icon, label } = getSaveState(release, entry);
  return `
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${ICONS[icon]}</svg>
    <span class="visually-hidden">${escapeHtml(label)}: ${escapeHtml(release.title)}</span>
  `;
}

const stubMonth = new Intl.DateTimeFormat('en-GB', { month: 'short' });

// The ticket stub in the poster's corner: the drop date while it's coming, the rating once it's out.
// It repeats what the text below says, so screen readers skip it.
function renderStub({ date, tba, rating }) {
  if (tba || !date) return '';
  const today = toIsoDate(new Date());
  if (date === today) return '<span class="release-card__stub release-card__stub--today" aria-hidden="true">Today</span>';
  if (date > today) {
    const [year, month, day] = date.split('-').map(Number);
    const monthName = stubMonth.format(new Date(year, month - 1, day));
    return `<span class="release-card__stub" aria-hidden="true"><span class="release-card__stub-month">${monthName}</span>${day}</span>`;
  }
  if (!rating) return '';
  return `<span class="release-card__stub release-card__stub--rating" aria-hidden="true">★ ${rating.toFixed(1)}</span>`;
}

// Games open their own page; movies, TV, anime and manga open the Quick view drawer (PRD sitemap rules).
function renderTitle(release) {
  const title = escapeHtml(release.title);
  if (release.type === 'game') {
    return `<a class="release-card__link" href="game.html?id=${release.id}">${title}</a>`;
  }
  return `<button class="release-card__link" type="button">${title}</button>`;
}

// Every card is a 2:3 poster. Games use their official IGDB cover when there is one; otherwise the wide
// RAWG key art sits in the middle of the poster on a blurred copy of itself, titled below like a box cover.
function isBoxArt(release) {
  return release.type === 'game' && !release.poster && Boolean(release.image);
}

// Game covers are 3:4, a little wider than the poster, so they're shown whole on a blurred copy of
// themselves instead of losing their edges (and often part of the logo) to a crop.
function isGameCover(release) {
  return release.type === 'game' && Boolean(release.poster);
}

function renderPoster(release) {
  const boxArt = isBoxArt(release);
  const src = release.poster ?? release.image;
  const modifier = boxArt ? ' release-card__image--wide' : isGameCover(release) ? ' release-card__image--whole' : '';
  const image = src
    ? `<img class="release-card__image${modifier}" src="${escapeHtml(src)}" alt="" ${boxArt ? 'width="640" height="360"' : 'width="342" height="513"'} loading="lazy" decoding="async">`
    : '';
  const boxTitle = boxArt ? `<span class="release-card__box-title" aria-hidden="true">${escapeHtml(release.title)}</span>` : '';
  return `${posterFallback(release.title)}${image}${boxTitle}${renderStub(release)}`;
}

export function createReleaseCard(release, { entry = null } = {}) {
  const card = document.createElement('article');
  card.className = `release-card release-card--${release.type}`;
  card.classList.toggle('release-card--saved', Boolean(entry));
  card.dataset.source = release.source;
  card.dataset.id = release.id;
  card.dataset.type = release.type;
  // Lets GSAP Flip recognise the same release across a re-render (M3).
  card.dataset.flipId = `${release.type}:${release.id}`;
  if (release.tint) card.style.setProperty('--poster-tint', release.tint);
  // A game's own art, blurred, fills the poster around its wide key art.
  if (isBoxArt(release)) card.style.setProperty('--poster-art', `url("${encodeURI(release.image)}")`);
  if (isGameCover(release)) card.style.setProperty('--poster-art', `url("${encodeURI(release.poster)}")`);

  const platforms = getPlatforms(release);

  card.innerHTML = `
    <div class="release-card__poster">
      ${renderPoster(release)}
    </div>
    <button class="release-card__save" type="button" aria-pressed="${Boolean(entry)}">
      ${renderSaveButton(release, entry)}
    </button>
    <div class="release-card__body">
      <h3 class="release-card__title">${renderTitle(release)}</h3>
      <p class="release-card__date">${getDateText(release)}</p>
      <p class="release-card__meta">
        <span class="release-card__category">${escapeHtml(getTypeLabel(release))}</span>${platforms ? ` · ${escapeHtml(platforms)}` : ''}
      </p>
    </div>
  `;

  const image = card.querySelector('.release-card__image');
  if (image) {
    image.addEventListener('load', () => image.classList.add('is-loaded'), { once: true });
    image.addEventListener('error', () => {
      image.remove();
      card.querySelector('.release-card__box-title')?.remove();
    }, { once: true });
  }

  card.querySelector('.release-card__save').addEventListener('click', () => {
    card.dispatchEvent(new CustomEvent('release:save', { bubbles: true, detail: { release } }));
  });

  if (release.type !== 'game') {
    card.querySelector('.release-card__link').addEventListener('click', () => {
      card.dispatchEvent(new CustomEvent('release:quickview', { bubbles: true, detail: { release } }));
    });
  }

  // Kept so the save button can be relabelled later without looking the release up again.
  card.release = release;
  return card;
}

export function setCardStatus(card, entry) {
  card.classList.toggle('release-card--saved', Boolean(entry));
  const button = card.querySelector('.release-card__save');
  button.setAttribute('aria-pressed', String(Boolean(entry)));
  button.innerHTML = renderSaveButton(card.release, entry);
}

export function createCardSkeleton() {
  const card = document.createElement('div');
  card.className = 'release-card release-card--loading';
  card.setAttribute('aria-hidden', 'true');
  card.innerHTML = `
    <div class="release-card__poster skeleton"></div>
    <div class="release-card__body">
      <span class="skeleton skeleton--heading"></span>
      <span class="skeleton skeleton--line skeleton--short"></span>
    </div>
  `;
  return card;
}
