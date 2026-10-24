import * as library from '../store/library.js';
import { setCardStatus } from './card.js';
import { showToast } from './toast.js';

const LIST_NAMES = {
  played: 'Played',
  playing: 'Playing',
  backlog: 'Backlog',
  radar: 'Radar',
};

const ERROR_MESSAGES = {
  corrupt: 'Nothing was saved because your Library data looks damaged. Open My Library to fix it.',
  unavailable: "Couldn't save. Your browser is blocking storage for this site.",
  'save-failed': "Couldn't save. Your browser storage may be full.",
};

function getDefaultStatus(release) {
  return release.type === 'game' ? 'backlog' : 'radar';
}

function showError(error) {
  showToast({ type: 'error', message: ERROR_MESSAGES[error] ?? "Couldn't save. Please try again." });
}

function undo(result) {
  const undone = library.undo(result);
  if (!undone.ok) showError(undone.error);
}

export function setReleaseStatus(release, status) {
  const result = library.setStatus(release, status);
  if (!result.ok) {
    showError(result.error);
    return;
  }
  if (result.unchanged) return;

  const verb = result.previous ? 'Moved' : 'Added';
  showToast({
    message: `${verb} “${release.title}” to ${LIST_NAMES[status]}`,
    viewHref: `library.html?tab=${status}`,
    onUndo: () => undo(result),
  });
}

export function removeRelease(release) {
  const result = library.removeEntry(release);
  if (!result.ok) {
    showError(result.error);
    return;
  }
  if (!result.previous) return;

  showToast({
    message: `Removed “${release.title}” from ${LIST_NAMES[result.previous.status]}`,
    onUndo: () => undo(result),
  });
}

// The one save action behind every + Backlog / + Radar button: saves, or removes when already saved.
// Played and Playing hold a log and review, so those open the game page instead of being removed by one tap.
export function toggleSave(release) {
  const status = library.getStatus(release);
  if (status === 'played' || status === 'playing') {
    location.href = `game.html?id=${release.id}`;
  } else if (status) {
    removeRelease(release);
  } else {
    setReleaseStatus(release, getDefaultStatus(release));
  }
}

// Brings every card under root in line with the Library, e.g. after an Undo or a change in another tab.
export function syncCards(root) {
  root.querySelectorAll('.release-card[data-type]').forEach((card) => {
    setCardStatus(card, library.getStatus({ type: card.dataset.type, id: card.dataset.id }));
  });
}
