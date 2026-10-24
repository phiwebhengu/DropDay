import * as library from '../store/library.js';
import { createReleaseCard, getDateText } from '../ui/card.js';
import { removeRelease, setReleaseStatus, syncCards, toggleSave } from '../ui/library-actions.js';
import { openQuickView } from '../ui/quick-view.js';
import { createStars, formatRating } from '../ui/rating.js';
import { createStateMessage } from '../ui/states.js';
import { showToast } from '../ui/toast.js';
import { formatMonthYear, formatRelative, formatShortDate, formatWeekday, toIsoDate } from '../utils/dates.js';
import { escapeHtml } from '../utils/html.js';

const TABS = ['played', 'playing', 'backlog', 'radar'];
const VIEWS = ['list', 'grid'];
const STANDARD_EDITION = 'Standard edition';

const LIST_NAMES = {
  played: 'Played',
  playing: 'Playing',
  backlog: 'Backlog',
  radar: 'Radar',
};

const CATEGORY_LABELS = {
  movie: 'Movie',
  tv: 'TV',
  anime: 'Anime',
};

const EMPTY_TEXT = {
  played: "Log a game you've finished and it starts your diary here.",
  playing: 'Mark a game as Playing to keep it close.',
  backlog: 'Tap + Backlog on any game to save it for later.',
  radar: 'Tap + Radar on a game, movie, show or anime to track its release.',
};

const tabs = [...document.querySelectorAll('.library-tab')];
const viewButtons = [...document.querySelectorAll('.view-toggle__option')];
const panel = document.getElementById('library-panel');
const activityList = document.getElementById('activity-list');
const activityEmpty = document.getElementById('activity-empty');
const exportButton = document.getElementById('export-button');

function readState() {
  const params = new URLSearchParams(location.search);
  return {
    tab: TABS.includes(params.get('tab')) ? params.get('tab') : 'played',
    view: VIEWS.includes(params.get('view')) ? params.get('view') : 'list',
  };
}

function writeState(state) {
  const params = new URLSearchParams({ tab: state.tab });
  if (state.view === 'grid') params.set('view', 'grid');
  history.replaceState(null, '', `?${params}`);
}

function renderCounts() {
  const counts = library.getCounts();
  document.querySelectorAll('[data-count]').forEach((element) => {
    element.textContent = counts[element.dataset.count];
  });
  document.querySelectorAll('[data-tab-count]').forEach((element) => {
    element.textContent = counts[element.dataset.tabCount];
  });
}

function renderControls(state) {
  tabs.forEach((tab) => {
    const selected = tab.dataset.tab === state.tab;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  panel.setAttribute('aria-labelledby', `tab-${state.tab}`);
  viewButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === state.view)));
}

function getMeta(entry) {
  const parts = [];
  if (entry.type === 'game') {
    if (entry.platform) parts.push(entry.platform);
    if (entry.edition && entry.edition !== STANDARD_EDITION) parts.push(entry.edition);
  } else {
    parts.push(CATEGORY_LABELS[entry.type]);
  }
  // Saved-for-later items care about when they drop; logged ones about when they were logged.
  if (entry.status === 'backlog' || entry.status === 'radar') parts.push(getDateText(entry));
  parts.push(entry.loggedAt ? `Logged ${formatShortDate(entry.loggedAt)}` : `Added ${formatShortDate(entry.addedAt)}`);
  return parts.join(' · ');
}

function renderTitle(entry) {
  const title = escapeHtml(entry.title);
  if (entry.type === 'game') return `<a class="library-row__link" href="game.html?id=${entry.id}">${title}</a>`;
  return `<button class="library-row__link" type="button">${title}</button>`;
}

function renderActions(entry, actionsId) {
  const moves = entry.type === 'game' ? TABS.filter((status) => status !== entry.status) : [];
  return `
    <div class="library-row__actions" id="${actionsId}" hidden>
      ${entry.type === 'game' ? `<a class="button button--outline library-row__action" href="game.html?id=${entry.id}&log=1">${entry.loggedAt ? 'Edit log' : 'Log or review'}</a>` : ''}
      ${moves.map((status) => `<button class="button button--outline library-row__action" type="button" data-move="${status}">Move to ${LIST_NAMES[status]}</button>`).join('')}
      <button class="button button--outline library-row__action library-row__action--danger" type="button" data-remove>Remove</button>
    </div>
  `;
}

function createReview(entry) {
  if (!entry.review) return null;
  const review = document.createElement('div');
  review.className = 'library-row__review';

  const text = document.createElement('p');
  text.className = 'library-row__review-text';
  text.textContent = entry.review;
  review.append(text);

  // Spoilers stay hidden from everyone, screen readers included, until asked for.
  if (entry.spoilers) {
    review.classList.add('library-row__review--spoiler');
    text.setAttribute('aria-hidden', 'true');
    const reveal = document.createElement('button');
    reveal.className = 'library-row__reveal';
    reveal.type = 'button';
    reveal.textContent = 'Show spoiler';
    reveal.addEventListener('click', () => {
      review.classList.remove('library-row__review--spoiler');
      text.removeAttribute('aria-hidden');
      reveal.remove();
      text.tabIndex = -1;
      text.focus();
    });
    review.append(reveal);
  }
  return review;
}

function createRow(entry, { diary = false } = {}) {
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
  const review = createReview(entry);
  if (review) body.append(review);

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
    if ('remove' in button.dataset) removeRelease(entry);
  });

  if (entry.type !== 'game') {
    const link = row.querySelector('.library-row__link');
    link.addEventListener('click', () => openQuickView(entry, link));
  }

  item.append(row);
  return item;
}

function createList(entries) {
  const list = document.createElement('ul');
  list.className = 'library-list';
  list.setAttribute('role', 'list');
  list.append(...entries.map((entry) => createRow(entry)));
  return list;
}

// Played, as a list, reads like a Letterboxd diary: grouped by the month each game was logged.
function createDiary(entries) {
  const sorted = [...entries].sort((a, b) => (b.loggedAt ?? b.updatedAt).localeCompare(a.loggedAt ?? a.updatedAt));
  const months = new Map();
  sorted.forEach((entry) => {
    const month = formatMonthYear(entry.loggedAt ?? entry.updatedAt);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(entry);
  });

  const diary = document.createElement('div');
  diary.className = 'diary';
  months.forEach((monthEntries, month) => {
    const section = document.createElement('section');
    section.className = 'diary__month';
    const heading = document.createElement('h2');
    heading.className = 'diary__heading';
    heading.textContent = month;
    const list = document.createElement('ul');
    list.className = 'library-list';
    list.setAttribute('role', 'list');
    list.append(...monthEntries.map((entry) => createRow(entry, { diary: true })));
    section.append(heading, list);
    diary.append(section);
  });
  return diary;
}

function createGrid(entries) {
  const grid = document.createElement('ul');
  grid.className = 'release-grid';
  grid.setAttribute('role', 'list');
  grid.append(
    ...entries.map((entry) => {
      const item = document.createElement('li');
      item.append(createReleaseCard(entry, { status: entry.status }));
      return item;
    }),
  );
  return grid;
}

function describeActivity({ action, title, status, rating }) {
  const name = `“${title}”`;
  if (action === 'logged') return `You logged ${name} as ${LIST_NAMES[status]}${rating ? ` · ${rating}★` : ''}`;
  if (action === 'moved') return `You moved ${name} to ${LIST_NAMES[status]}`;
  if (action === 'removed') return `You removed ${name}`;
  return `You added ${name} to ${LIST_NAMES[status]}`;
}

function renderActivity() {
  const problem = library.getProblem();
  const activity = problem ? [] : library.getActivity();
  activityEmpty.hidden = activity.length > 0;
  activityEmpty.textContent = problem
    ? 'Activity is unavailable until your Library is fixed.'
    : 'Nothing yet. Save or log something and it shows up here.';
  activityList.replaceChildren(
    ...activity.map((item) => {
      const row = document.createElement('li');
      row.className = 'activity__item';
      const time = document.createElement('time');
      time.className = 'activity__time';
      time.dateTime = item.at;
      time.textContent = formatRelative(item.at);
      row.append(`${describeActivity(item)} · `, time);
      return row;
    }),
  );
}

function exportLibrary() {
  const blob = new Blob([library.exportLibrary()], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `dropday-library-${toIsoDate(new Date())}.json`;
  link.click();
  // Firefox needs the link to live a moment longer before the file URL is released.
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showToast({ message: 'Library exported. Check your downloads.' });
}

// Damaged data is never wiped quietly: the user can export what's there first, then choose to start fresh.
function createRecovery() {
  const message = createStateMessage({
    type: 'error',
    title: "Your Library couldn't be read",
    text: 'The saved data on this device looks damaged. Nothing has been deleted. Export a copy first, then reset to start a fresh Library.',
    actionLabel: 'Export a copy',
    onAction: exportLibrary,
  });

  const reset = document.createElement('button');
  reset.className = 'button button--outline library__reset';
  reset.type = 'button';
  reset.textContent = 'Reset library';
  reset.addEventListener('click', () => {
    // Two steps, so a stray tap can't wipe anything.
    if (reset.dataset.confirm !== 'true') {
      reset.dataset.confirm = 'true';
      reset.textContent = 'Yes, reset and start fresh';
      return;
    }
    const result = library.resetLibrary();
    showToast(
      result.ok
        ? { message: 'Library reset. You can start saving again.' }
        : { type: 'error', message: "Couldn't reset. Your browser is blocking storage for this site." },
    );
  });
  message.append(reset);
  return message;
}

function renderPanel() {
  const state = readState();
  if (library.getProblem() === 'corrupt') {
    panel.replaceChildren(createRecovery());
    return;
  }
  if (library.getProblem()) {
    panel.replaceChildren(
      createStateMessage({
        type: 'error',
        title: "Your Library isn't available",
        text: 'Your browser is blocking storage for this site, so nothing can be saved. Check your privacy settings.',
      }),
    );
    return;
  }

  const entries = library.listByStatus(state.tab);
  if (!entries.length) {
    panel.replaceChildren(
      createStateMessage({
        type: 'empty',
        title: 'Nothing here yet',
        text: EMPTY_TEXT[state.tab],
        actionLabel: 'Browse releases',
        onAction: () => {
          location.href = 'discover.html';
        },
      }),
    );
    return;
  }

  if (state.view === 'grid') panel.replaceChildren(createGrid(entries));
  else if (state.tab === 'played') panel.replaceChildren(createDiary(entries));
  else panel.replaceChildren(createList(entries));
}

function update(changes) {
  const state = { ...readState(), ...changes };
  writeState(state);
  renderControls(state);
  renderCounts();
  renderPanel();
  renderActivity();
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => update({ tab: tab.dataset.tab }));
  tab.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    const next = tabs[(index + step + tabs.length) % tabs.length];
    next.focus();
    next.click();
  });
});

viewButtons.forEach((button) => button.addEventListener('click', () => update({ view: button.dataset.view })));
exportButton.addEventListener('click', exportLibrary);

panel.addEventListener('release:save', (event) => toggleSave(event.detail.release));
panel.addEventListener('release:quickview', (event) => {
  openQuickView(event.detail.release, event.target.querySelector('.release-card__link'));
});

// A move or remove changes what this tab holds, so it redraws; focus goes to the panel instead of being lost.
window.addEventListener('library:change', () => {
  const hadFocus = panel.contains(document.activeElement);
  renderCounts();
  renderPanel();
  renderActivity();
  syncCards(panel);
  if (hadFocus) panel.focus();
});

update({});
