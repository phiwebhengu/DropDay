// Five stars filled to the rating (0–5, halves allowed). Purely visual: callers always show the number as text too.
export function createStars(value) {
  const stars = document.createElement('span');
  stars.className = 'stars';
  stars.setAttribute('aria-hidden', 'true');
  stars.style.setProperty('--rating', value);
  stars.textContent = '★★★★★';
  return stars;
}

export function formatRating(value) {
  return `${Number(value.toFixed(1))}/5`;
}
