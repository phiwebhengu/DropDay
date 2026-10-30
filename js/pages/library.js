import * as library from '../store/library.js';
import { createReleaseCard } from '../ui/card.js';
import { syncCards, toggleSave } from '../ui/library-actions.js';
import { createLibraryRow } from '../ui/library-row.js';
import { openQuickView } from '../ui/quick-view.js';
import { createStateMessage } from '../ui/states.js';
import { showToast } from '../ui/toast.js';
import { formatMonthYear, formatRelative, toIsoDate } from '../utils/dates.js';
import { LIST_NAMES, STATUSES, getStatusLabel } from '../utils/media.js';
import { countTo } from '../motion.js';
import '../ui/save-feedback.js';
import '../ui/theme.js';
import '../ui/site-header.js';

const VIEWS = ['list', 'grid'];

const EMPTY_TEXT = {
  want: 'Save anything you want to play, watch or read. Upcoming titles get a 🔔 so you know when they drop.',
  doing: 'Start something from your Want to list and it moves here.',
  done: "Log something you've finished and it starts your diary here.",
  dropped: "Anything you stop partway goes here, so it's out of the way but not forgotten.",
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
    tab: STATUSES.includes(params.get('tab')) ? params.get('tab') : 'want',
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
    countTo(element, counts[element.dataset.count]);
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

function createList(entries) {
  const list = document.createElement('ul');
  list.className = 'library-list';
  list.setAttribute('role', 'list');
  list.append(...entries.map((entry) => createLibraryRow(entry)));
  return list;
}

// Done, as a list, reads like a Letterboxd diary: grouped by the month each title was logged.
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
    list.append(...monthEntries.map((entry) => createLibraryRow(entry, { diary: true })));
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
      item.append(createReleaseCard(entry, { entry }));
      return item;
    }),
  );
  return grid;
}

function describeActivity({ action, title, type, status, rating }) {
  const name = `“${title}”`;
  const list = getStatusLabel(type, status);
  if (action === 'logged') return `You logged ${name} as ${list}${rating ? ` · ${rating}★` : ''}`;
  if (action === 'moved') return `You moved ${name} to ${list}`;
  if (action === 'removed') return `You removed ${name}`;
  if (action === 'reminded') return `You set a reminder for ${name}`;
  if (action === 'unreminded') return `You turned off the reminder for ${name}`;
  return `You added ${name} to ${list}`;
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

  if (state.tab === 'done' && state.view === 'list') {
    panel.replaceChildren(createDiary(entries));
    return;
  }
  // The diary has month headings; the plain list and grid get a hidden one, so titles don't jump from h1 to h3.
  const heading = document.createElement('h2');
  heading.className = 'visually-hidden';
  heading.textContent = LIST_NAMES[state.tab];
  panel.replaceChildren(heading, state.view === 'grid' ? createGrid(entries) : createList(entries));
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
