// The same icons as the game page's status buttons, so "Move to Played" looks like the Played button.
const svg = (path, filled = false) =>
  `<svg width="16" height="16" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

export const STATUS_ICONS = {
  want: svg('<path d="M7 4h10v16l-5-4-5 4z" />'),
  doing: svg('<path d="M7 4.5v15l12-7.5z" />', true),
  done: svg('<path d="m5 12 5 5L20 7" />'),
  dropped: svg('<path d="m6 6 12 12M18 6 6 18" />'),
  remind: svg('<path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16zM10 20a2 2 0 0 0 4 0" />'),
  log: svg('<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z" />'),
  remove: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />'),
};
