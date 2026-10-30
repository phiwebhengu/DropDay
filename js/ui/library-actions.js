import * as library from '../store/library.js';
import { getStatusLabel, isReleased } from '../utils/media.js';
import { setCardStatus } from './card.js';
import { showToast } from './toast.js';

const ERROR_MESSAGES = {
  corrupt: 'Nothing was saved because your Library data looks damaged. Open My Library to fix it.',
  unavailable: "Couldn't save. Your browser is blocking storage for this site.",
  'save-failed': "Couldn't save. Your browser storage may be full.",
};

function showError(error) {
  showToast({ type: 'error', message: ERROR_MESSAGES[error] ?? "Couldn't save. Please try again." });
}

function undo(result) {
  const undone = library.undo(result);
  if (!undone.ok) showError(undone.error);
}

// Wraps a store call: shows the error if it failed, and says whether there's anything to announce.
function run(result) {
  if (!result.ok) {
    showError(result.error);
    return false;
  }
  return !result.unchanged;
}

export function setReleaseStatus(release, status) {
  const result = library.setStatus(release, status);
  if (!run(result)) return;

  const verb = result.previous ? 'Moved' : 'Added';
  showToast({
    message: `${verb} “${release.title}” to ${getStatusLabel(release.type, status)}`,
    viewHref: `library.html?tab=${status}`,
    onUndo: () => undo(result),
  });
}

export function setReminder(release, remind) {
  const result = library.setRemind(release, remind);
  if (!run(result)) return;

  showToast({
    message: remind ? `We’ll remind you when “${release.title}” drops` : `Reminder off for “${release.title}”`,
    viewHref: remind ? 'library.html?tab=want' : undefined,
    onUndo: () => undo(result),
  });
}

// Returns true when saved, so the Log modal knows whether it can close.
export function saveLogEntry(release, log) {
  const result = library.saveLog(release, log);
  if (!run(result)) return false;

  const rating = log.rating ? ` · ${log.rating}★` : '';
  showToast({
    message: `Logged “${release.title}” as ${getStatusLabel(release.type, log.status)}${rating}`,
    viewHref: `library.html?tab=${log.status}`,
    onUndo: () => undo(result),
  });
  return true;
}

export function removeRelease(release) {
  const result = library.removeEntry(release);
  if (!run(result) || !result.previous) return;

  showToast({
    message: `Removed “${release.title}” from ${getStatusLabel(release.type, result.previous.status)}`,
    onUndo: () => undo(result),
  });
}

// The one save action behind every card's save button. Not saved yet: released titles go to Want to,
// upcoming ones also get Remind me. Already saved: removed, unless it holds progress or a log,
// in which case a game opens its page instead of losing that work to one tap.
export function toggleSave(release) {
  const entry = library.getEntry(release);
  if (!entry) {
    if (isReleased(release)) setReleaseStatus(release, 'want');
    else setReminder(release, true);
  } else if (release.type === 'game' && (entry.status === 'doing' || entry.status === 'done')) {
    location.href = `game.html?id=${release.id}`;
  } else {
    removeRelease(release);
  }
}

// Brings every card under root in line with the Library, e.g. after an Undo or a change in another tab.
export function syncCards(root) {
  root.querySelectorAll('.release-card[data-type]').forEach((card) => {
    const { source, type, id } = card.dataset;
    setCardStatus(card, library.getEntry({ source, type, id }));
  });
}
