import { STORAGE_KEYS } from '../config.js';
import { STATUSES } from '../utils/media.js';

const ACTIVITY_LIMIT = 20;
const LOG_FIELDS = ['platform', 'edition', 'rating', 'review', 'spoilers', 'liked'];

// The first version used game-centred lists; this is how they map onto the lists every medium shares.
// Radar meant "tell me when it's out", which is now the Remind me flag on a Want to entry.
const LEGACY_STATUSES = {
  played: { status: 'done' },
  playing: { status: 'doing' },
  backlog: { status: 'want' },
  radar: { status: 'want', remind: true },
};

// The library is read from storage once, then kept here. If the saved data can't be trusted, "problem"
// is set and every write is refused until the user decides what to do (#23), so nothing gets wiped.
let library = null;
let problem = null;
let activityCount = 0;

function emptyLibrary() {
  return { items: [], activity: [] };
}

function isValid(data, statuses) {
  return (
    Array.isArray(data?.items) &&
    Array.isArray(data.activity) &&
    data.items.every((item) => typeof item?.key === 'string' && statuses.includes(item.status))
  );
}

// Two sources can share an id (RAWG, TMDB and AniList all count from 1), so the key holds all three parts.
export function getKey({ source, type, id }) {
  return `${source}:${type}:${id}`;
}

function migrateEntry(item) {
  const { status, remind = false } = LEGACY_STATUSES[item.status];
  return { subtype: null, liked: false, units: {}, ...item, key: getKey(item), status, remind };
}

function migrateActivity(item, sources) {
  return { ...item, key: sources[item.key] ?? item.key, status: LEGACY_STATUSES[item.status]?.status ?? item.status };
}

function readJson(key) {
  const raw = localStorage.getItem(key);
  return raw === null ? null : JSON.parse(raw);
}

// Carries a first-version library over once. The old copy stays where it was, as a backup.
function migrateLegacy() {
  const legacy = readJson(STORAGE_KEYS.legacyLibrary);
  if (legacy === null) return null;
  if (!isValid(legacy, Object.keys(LEGACY_STATUSES))) throw new Error('Unexpected legacy library shape');

  const items = legacy.items.map(migrateEntry);
  const sources = Object.fromEntries(legacy.items.map((item, index) => [item.key, items[index].key]));
  const migrated = { items, activity: legacy.activity.map((item) => migrateActivity(item, sources)) };
  localStorage.setItem(STORAGE_KEYS.library, JSON.stringify(migrated));
  return migrated;
}

function load() {
  if (library) return library;
  try {
    const data = readJson(STORAGE_KEYS.library) ?? migrateLegacy();
    if (data && !isValid(data, STATUSES)) throw new Error('Unexpected library shape');
    library = data ?? emptyLibrary();
  } catch (error) {
    // A SecurityError means storage is switched off; anything else means the saved data is damaged.
    problem = error?.name === 'SecurityError' ? 'unavailable' : 'corrupt';
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

// action is null for small changes (ticking off an episode) that would only clutter Activity.
function withChange(entry, action) {
  const current = load();
  const items = current.items.filter((item) => item.key !== entry.key);
  const activity = action
    ? [toActivity(entry, action), ...current.activity].slice(0, ACTIVITY_LIMIT)
    : current.activity;
  return { items: entry.status ? [entry, ...items] : items, activity };
}

function createEntry(release, status) {
  const now = new Date().toISOString();
  return {
    key: getKey(release),
    source: release.source,
    id: release.id,
    type: release.type,
    subtype: release.subtype ?? null,
    title: release.title,
    image: release.image ?? null,
    date: release.date ?? null,
    tba: Boolean(release.tba),
    season: release.season ?? null,
    platforms: release.platforms ?? [],
    status,
    remind: false,
    liked: false,
    platform: null,
    edition: null,
    rating: null,
    review: '',
    spoilers: false,
    units: {},
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

// Remind me lives on a Want to entry: turning it on saves the release there if it isn't saved yet.
export function setRemind(release, remind) {
  const existing = getEntry(release);
  if (Boolean(existing?.remind) === remind && existing) return { ok: true, entry: existing, unchanged: true };

  const base = existing ?? createEntry(release, 'want');
  const entry = { ...base, remind, updatedAt: new Date().toISOString() };
  const result = save(withChange(entry, remind ? 'reminded' : 'unreminded'));
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

// One episode or chapter: "s1e3" for an episode, "c42" for a chapter. Ticking the first one off
// moves a Want to entry to In progress, the way Simkl does.
export function setUnit(release, unitKey, changes) {
  const previous = getEntry(release);
  const base = previous ?? createEntry(release, 'doing');
  const units = { ...base.units };
  const unit = { ...units[unitKey], ...changes, at: new Date().toISOString() };
  if (!unit.watched && unit.rating == null) delete units[unitKey];
  else units[unitKey] = unit;

  const status = base.status === 'want' && unit.watched ? 'doing' : base.status;
  const entry = { ...base, status, units, updatedAt: unit.at };
  const result = save(withChange(entry, previous ? null : 'added'));
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

export function listByStatus(status) {
  return load()
    .items.filter((item) => item.status === status)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function listReminders() {
  return load().items.filter((item) => item.remind);
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

// The file Export downloads. When the saved data is damaged it holds the raw text as it is,
// so nothing is lost even if it can't be read here.
export function exportLibrary() {
  load();
  if (problem === 'corrupt') {
    try {
      return localStorage.getItem(STORAGE_KEYS.library) ?? localStorage.getItem(STORAGE_KEYS.legacyLibrary) ?? '';
    } catch {
      return '';
    }
  }
  return JSON.stringify({ app: 'Drop Day', version: 2, exportedAt: new Date().toISOString(), ...library }, null, 2);
}

// Only ever called from the recovery prompt, after the user has had the chance to export.
// The old copy goes too, or it would be carried over again on the next load.
export function resetLibrary() {
  try {
    localStorage.removeItem(STORAGE_KEYS.library);
    localStorage.removeItem(STORAGE_KEYS.legacyLibrary);
  } catch {
    return { ok: false, error: 'save-failed' };
  }
  library = emptyLibrary();
  problem = null;
  window.dispatchEvent(new CustomEvent('library:change'));
  return { ok: true };
}

// Another tab changed the library: drop the copy in memory so the next read picks up the new data.
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEYS.library) return;
  library = null;
  problem = null;
  window.dispatchEvent(new CustomEvent('library:change'));
});
