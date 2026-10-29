// One place for the words each medium uses, so every page says "Want to read" for manga
// and "Want to play" for games without repeating the rules.

export const STATUSES = ['want', 'doing', 'done', 'dropped'];

const VERBS = {
  game: { want: 'Want to play', doing: 'Playing', done: 'Played' },
  movie: { want: 'Want to watch', doing: 'Watching', done: 'Watched' },
  tv: { want: 'Want to watch', doing: 'Watching', done: 'Watched' },
  anime: { want: 'Want to watch', doing: 'Watching', done: 'Watched' },
  manga: { want: 'Want to read', doing: 'Reading', done: 'Read' },
};

const TYPE_LABELS = {
  game: 'Game',
  movie: 'Movie',
  tv: 'TV',
  anime: 'Anime',
  manga: 'Manga',
};

// Library tabs mix every medium, so they use the neutral words.
export const LIST_NAMES = {
  want: 'Want to',
  doing: 'In progress',
  done: 'Done',
  dropped: 'Dropped',
};

// Manga also covers manhwa (Korea) and manhua (China); the release says which.
export function getTypeLabel({ type, subtype }) {
  return subtype ?? TYPE_LABELS[type];
}

export function getStatusLabel(type, status) {
  return status === 'dropped' ? 'Dropped' : VERBS[type]?.[status] ?? LIST_NAMES[status];
}

// A film is watched in one sitting, so it has no "in progress" list.
export function getStatusesFor(type) {
  return type === 'movie' ? STATUSES.filter((status) => status !== 'doing') : STATUSES;
}

export function isReleased({ date, tba }) {
  if (tba || !date) return false;
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day) <= new Date();
}
