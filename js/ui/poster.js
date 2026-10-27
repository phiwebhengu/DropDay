import { escapeHtml } from '../utils/html.js';

// Shown when a release has no art, or its art fails to load: the title set like a title card.
// Small covers only have room for the first letter. It's decorative, as the real title is always nearby.
export function posterFallback(title, { initial = false } = {}) {
  const text = initial ? [...title.trim()][0] ?? '' : title;
  const modifier = initial ? ' poster-fallback--initial' : '';
  return `<span class="poster-fallback${modifier}" aria-hidden="true">${escapeHtml(text)}</span>`;
}
