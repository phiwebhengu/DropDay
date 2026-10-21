import { formatReleaseDate, toIsoDate } from '../utils/dates.js';
import { escapeHtml } from '../utils/html.js';

const MAX_PLATFORM_TAGS = 3;

const CATEGORY_LABELS = {
  game: 'Game',
  movie: 'Movie',
  tv: 'TV',
  anime: 'Anime',
};

const DATE_PREFIXES = {
  game: 'Releases',
  movie: 'In cinemas',
  tv: 'Premieres',
  anime: 'Streams',
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
};

function getDateText({ type, date, tba, season }) {
  if (tba) return 'Release date TBA';

  const today = toIsoDate(new Date());
  if (date === today) return season > 1 ? `Season ${season} out today` : 'Out today';

  const isPast = date < today;
  if (season > 1) return `Season ${season} ${isPast ? 'premiered' : 'premieres'} ${formatReleaseDate(date)}`;

  const prefix = isPast ? PAST_PREFIXES[type] : DATE_PREFIXES[type];
  return `${prefix} ${formatReleaseDate(date)}`;
}

function getTags({ type, platforms }) {
  if (type === 'movie') return ['Cinema'];
  const names = platforms.map((name) => PLATFORM_NAMES[name] ?? name);
  const extra = names.length - MAX_PLATFORM_TAGS;
  return extra > 0 ? [...names.slice(0, MAX_PLATFORM_TAGS), `+${extra}`] : names;
}

function getSaveText(type, saved) {
  if (type === 'game') return saved ? '✓ In Backlog' : '+ Backlog';
  return saved ? '✓ On Radar' : '+ Radar';
}

// Games open their own page; movies, TV and anime open the Quick view drawer (PRD sitemap rules).
function renderTitle(release) {
  const title = escapeHtml(release.title);
  if (release.type === 'game') {
    return `<a class="release-card__link" href="game.html?id=${release.id}">${title}</a>`;
  }
  return `<button class="release-card__link" type="button">${title}</button>`;
}

export function createReleaseCard(release, { saved = false } = {}) {
  const card = document.createElement('article');
  card.className = `release-card release-card--${release.type}`;
  card.classList.toggle('release-card--saved', saved);
  card.dataset.id = release.id;

  const tags = getTags(release)
    .map((tag) => `<li class="tag">${escapeHtml(tag)}</li>`)
    .join('');

  card.innerHTML = `
    <div class="release-card__media">
      ${release.image ? `<img class="release-card__image" src="${escapeHtml(release.image)}" alt="" width="600" height="400" loading="lazy" decoding="async">` : ''}
    </div>
    <div class="release-card__body">
      <p class="release-card__category">${CATEGORY_LABELS[release.type]}</p>
      <h3 class="release-card__title">${renderTitle(release)}</h3>
      <p class="release-card__date">${getDateText(release)}</p>
      ${tags ? `<ul class="release-card__tags" role="list">${tags}</ul>` : ''}
      <button class="button button--outline release-card__save" type="button" aria-pressed="${saved}">
        ${getSaveText(release.type, saved)}
        <span class="visually-hidden">: ${escapeHtml(release.title)}</span>
      </button>
    </div>
  `;

  const image = card.querySelector('.release-card__image');
  if (image) {
    image.addEventListener('load', () => image.classList.add('is-loaded'), { once: true });
    image.addEventListener('error', () => image.remove(), { once: true });
  }

  card.querySelector('.release-card__save').addEventListener('click', () => {
    card.dispatchEvent(new CustomEvent('release:save', { bubbles: true, detail: { release } }));
  });

  if (release.type !== 'game') {
    card.querySelector('.release-card__link').addEventListener('click', () => {
      card.dispatchEvent(new CustomEvent('release:quickview', { bubbles: true, detail: { release } }));
    });
  }

  return card;
}

export function setCardSaved(card, type, saved) {
  card.classList.toggle('release-card--saved', saved);
  const button = card.querySelector('.release-card__save');
  button.setAttribute('aria-pressed', String(saved));
  button.firstChild.textContent = `${getSaveText(type, saved)}\n`;
}

export function createCardSkeleton() {
  const card = document.createElement('div');
  card.className = 'release-card release-card--loading';
  card.setAttribute('aria-hidden', 'true');
  card.innerHTML = `
    <div class="release-card__media skeleton"></div>
    <div class="release-card__body">
      <span class="skeleton skeleton--line skeleton--short"></span>
      <span class="skeleton skeleton--heading"></span>
      <span class="skeleton skeleton--line"></span>
      <span class="skeleton skeleton--button"></span>
    </div>
  `;
  return card;
}
