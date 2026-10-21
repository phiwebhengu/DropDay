import { STORAGE_KEYS } from '../config.js';

export const STATUSES = ['played', 'playing', 'backlog', 'radar'];

const ACTIVITY_LIMIT = 20;
const LOG_FIELDS = ['platform', 'edition', 'rating', 'review', 'spoilers'];

// The library is read from storage once, then kept here. If the saved data can't be trusted, "problem"
// is set and every write is refused until the user decides what to do (#23), so nothing gets wiped.
let library = null;
let problem = null;
let activityCount = 0;

function emptyLibrary() {
  return { items: [], activity: [] };
}

function isValid(data) {
  return (
    Array.isArray(data?.items) &&
    Array.isArray(data.activity) &&
    data.items.every((item) => typeof item?.key === 'string' && STATUSES.includes(item.status))
  );
}

function load() {
  if (library) return library;
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEYS.library);
  } catch {
    problem = 'unavailable';
    library = emptyLibrary();
    return library;
  }

  if (raw === null) {
    library = emptyLibrary();
    return library;
  }

  try {
    const data = JSON.parse(raw);
    if (!isValid(data)) throw new Error('Unexpected library shape');
    library = data;
  } catch {
    problem = 'corrupt';
    library = emptyLibrary();
  }
  return library;
}

function save(next) {
  if (problem) return { ok: false, error: problem };
  const activityId = next.activity[0]?.id;
  try {
    localStorage.setItem(STORAGE_KEYS.library, JSON.stringify(next));
  } catch {
    return { ok: false, error: 'save-failed' };
  }
  library = next;
  window.dispatchEvent(new CustomEvent('library:change'));
  return { ok: true, activityId };
}

// Games come from RAWG and the rest from TMDB, so the id alone can clash; the type keeps them apart.
export function getKey({ type, id }) {
  return `${type}:${id}`;
}

function toActivity(entry, action) {
  activityCount += 1;
  return {
    id: `${Date.now()}-${activityCount}`,
    key: entry.key,
    title: entry.title,
    type: entry.type,
    action,
    status: entry.status,
    rating: entry.rating ?? null,
    at: new Date().toISOString(),
  };
}

function withChange(entry, action) {
  const current = load();
  const items = current.items.filter((item) => item.key !== entry.key);
  const activity = [toActivity(entry, action), ...current.activity].slice(0, ACTIVITY_LIMIT);
  return { items: entry.status ? [entry, ...items] : items, activity };
}

function createEntry(release, status) {
  const now = new Date().toISOString();
  return {
    key: getKey(release),
    source: release.source,
    id: release.id,
    type: release.type,
    title: release.title,
    image: release.image ?? null,
    date: release.date ?? null,
    tba: Boolean(release.tba),
    season: release.season ?? null,
    platforms: release.platforms ?? [],
    status,
    platform: null,
    edition: null,
    rating: null,
    review: '',
    spoilers: false,
    addedAt: now,
    updatedAt: now,
    loggedAt: null,
  };
}

export function getProblem() {
  load();
  return problem;
}

export function getEntry(release) {
  return load().items.find((item) => item.key === getKey(release)) ?? null;
}

export function getStatus(release) {
  return getEntry(release)?.status ?? null;
}

export function setStatus(release, status) {
  if (!STATUSES.includes(status)) return { ok: false, error: 'invalid-status' };
  const existing = getEntry(release);
  if (existing?.status === status) return { ok: true, entry: existing, unchanged: true };

  const entry = existing
    ? { ...existing, status, updatedAt: new Date().toISOString() }
    : createEntry(release, status);
  const result = save(withChange(entry, existing ? 'moved' : 'added'));
  return result.ok ? { ...result, entry, previous: existing } : result;
}

export function saveLog(release, log) {
  if (!STATUSES.includes(log.status)) return { ok: false, error: 'invalid-status' };
  const previous = getEntry(release);
  const now = new Date().toISOString();
  const entry = {
    ...(previous ?? createEntry(release, log.status)),
    status: log.status,
    updatedAt: now,
    loggedAt: now,
  };
  LOG_FIELDS.forEach((field) => {
    if (field in log) entry[field] = log[field];
  });

  const result = save(withChange(entry, 'logged'));
  return result.ok ? { ...result, entry, previous } : result;
}

export function removeEntry(release) {
  const previous = getEntry(release);
  if (!previous) return { ok: true, entry: null, previous: null };
  const result = save(withChange({ ...previous, status: null }, 'removed'));
  return result.ok ? { ...result, entry: null, previous } : result;
}

// Undo takes the result of the last change and puts things back exactly as they were.
// Its Activity line goes too, since the undone action never really happened.
export function undo({ entry, previous, unchanged, activityId }) {
  if (unchanged) return { ok: true };
  const key = (previous ?? entry)?.key;
  if (!key) return { ok: true };
  const current = load();
  const items = current.items.filter((item) => item.key !== key);
  const activity = current.activity.filter((item) => item.id !== activityId);
  return save({ items: previous ? [previous, ...items] : items, activity });
}

export function toggleRadar(release) {
  return getStatus(release) === 'radar' ? removeEntry(release) : setStatus(release, 'radar');
}

export function listByStatus(status) {
  return load()
    .items.filter((item) => item.status === status)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCounts() {
  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  load().items.forEach((item) => {
    counts[item.status] += 1;
  });
  return counts;
}

export function getActivity() {
  return load().activity;
}

// Another tab changed the library: drop the copy in memory so the next read picks up the new data.
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEYS.library) return;
  library = null;
  problem = null;
  window.dispatchEvent(new CustomEvent('library:change'));
});
