import { getDateText } from './card.js';
import { removeRelease, setReleaseStatus, setReminder } from './library-actions.js';
import { openQuickView } from './quick-view.js';
import { createStars, formatRating } from './rating.js';
import { formatShortDate, formatWeekday } from '../utils/dates.js';
import { escapeHtml } from '../utils/html.js';
import { getStatusesFor, getStatusLabel, getTypeLabel, isReleased } from '../utils/media.js';
import { posterFallback } from './poster.js';
import { createReview } from './review.js';

const STANDARD_EDITION = 'Standard edition';

function getMeta(entry) {
  const parts = [];
  if (entry.type === 'game') {
    if (entry.platform) parts.push(entry.platform);
    if (entry.edition && entry.edition !== STANDARD_EDITION) parts.push(entry.edition);
  } else {
    parts.push(getTypeLabel(entry));
  }
  // Saved-for-later items care about when they drop; logged ones about when they were logged.
  if (entry.status === 'want') parts.push(`${entry.remind ? '🔔 ' : ''}${getDateText(entry)}`);
  parts.push(entry.loggedAt ? `Logged ${formatShortDate(entry.loggedAt)}` : `Added ${formatShortDate(entry.addedAt)}`);
  return parts.join(' · ');
}

function renderTitle(entry) {
  const title = escapeHtml(entry.title);
  if (entry.type === 'game') return `<a class="library-row__link" href="game.html?id=${entry.id}">${title}</a>`;
  return `<button class="library-row__link" type="button">${title}</button>`;
}

function renderActions(entry, actionsId) {
  const moves = getStatusesFor(entry.type).filter((status) => status !== entry.status);
  const canRemind = entry.status === 'want' && !isReleased(entry);
  return `
    <div class="library-row__actions" id="${actionsId}" hidden>
      ${entry.type === 'game' ? `<a class="button button--outline library-row__action" href="game.html?id=${entry.id}&log=1">${entry.loggedAt ? 'Edit log' : 'Log or review'}</a>` : ''}
      ${canRemind ? `<button class="button button--outline library-row__action" type="button" data-remind>${entry.remind ? 'Turn reminder off' : '🔔 Remind me'}</button>` : ''}
      ${moves.map((status) => `<button class="button button--outline library-row__action" type="button" data-move="${status}">Move to ${getStatusLabel(entry.type, status)}</button>`).join('')}
      <button class="button button--outline library-row__action library-row__action--danger" type="button" data-remove>Remove</button>
    </div>
  `;
}

// One saved item as a row, used in My Library and on Home. diary adds the day column for Played.
export function createLibraryRow(entry, { diary = false } = {}) {
  const item = document.createElement('li');
  const row = document.createElement('article');
  row.className = `library-row library-row--${entry.type}`;
  if (diary) row.classList.add('library-row--diary');
  const actionsId = `actions-${entry.key.replace(':', '-')}`;
  const loggedOn = entry.loggedAt ?? entry.updatedAt;

  row.innerHTML = `
    ${
      diary
        ? `<time class="library-row__day" datetime="${loggedOn.slice(0, 10)}">
            <span class="library-row__day-number">${new Date(loggedOn).getDate()}</span>
            <span class="library-row__day-name">${formatWeekday(loggedOn)}</span>
          </time>`
        : ''
    }
    <div class="library-row__cover">
      ${posterFallback(entry.title, { initial: true })}
      ${entry.image ? `<img class="library-row__image" src="${escapeHtml(entry.image)}" alt="" loading="lazy" decoding="async">` : ''}
    </div>
    <div class="library-row__body">
      <h3 class="library-row__title">${renderTitle(entry)}</h3>
      <p class="library-row__meta">${escapeHtml(getMeta(entry))}</p>
    </div>
    <button class="library-row__more" type="button" aria-expanded="false" aria-controls="${actionsId}">
      <span aria-hidden="true">⋯</span>
      <span class="visually-hidden">More actions for ${escapeHtml(entry.title)}</span>
    </button>
    ${renderActions(entry, actionsId)}
  `;

  const body = row.querySelector('.library-row__body');
  if (entry.rating) {
    const rating = document.createElement('p');
    rating.className = 'library-row__rating';
    const value = document.createElement('span');
    value.textContent = formatRating(entry.rating);
    rating.append(createStars(entry.rating), value);
    body.append(rating);
  }
  if (entry.review) {
    const review = createReview(entry.review, { spoilers: entry.spoilers, clamped: true });
    review.classList.add('library-row__review');
    body.append(review);
  }

  row.querySelector('.library-row__image')?.addEventListener('error', (event) => event.target.remove(), { once: true });

  const more = row.querySelector('.library-row__more');
  const actions = row.querySelector('.library-row__actions');
  more.addEventListener('click', () => {
    const open = more.getAttribute('aria-expanded') !== 'true';
    more.setAttribute('aria-expanded', String(open));
    actions.hidden = !open;
  });

  actions.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.move) setReleaseStatus(entry, button.dataset.move);
    if ('remind' in button.dataset) setReminder(entry, !entry.remind);
    if ('remove' in button.dataset) removeRelease(entry);
  });

  if (entry.type !== 'game') {
    const link = row.querySelector('.library-row__link');
    link.addEventListener('click', () => openQuickView(entry, link));
  }

  item.append(row);
  return item;
}
