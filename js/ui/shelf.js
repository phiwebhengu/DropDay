// Shelves: a row of posters that swipes on touch, with arrow buttons that page it for mouse users.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export function updateShelfArrows(section) {
  const track = section.querySelector('.shelf__track');
  const [prev, next] = section.querySelectorAll('.shelf__arrow');
  const scrollable = track.scrollWidth > track.clientWidth + 4;
  prev.hidden = !scrollable || track.scrollLeft <= 4;
  next.hidden = !scrollable || track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
}

export function setupShelf(section) {
  const track = section.querySelector('.shelf__track');
  const [prev, next] = section.querySelectorAll('.shelf__arrow');
  const page = (direction) =>
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  prev.addEventListener('click', () => page(-1));
  next.addEventListener('click', () => page(1));
  track.addEventListener('scroll', () => updateShelfArrows(section), { passive: true });
  new ResizeObserver(() => updateShelfArrows(section)).observe(track);
}

export function createShelfItem(content, rank = null) {
  const item = document.createElement('li');
  item.className = 'shelf__item';
  if (rank) {
    const number = document.createElement('span');
    number.className = 'shelf__rank';
    number.setAttribute('aria-hidden', 'true');
    number.textContent = rank;
    item.append(number);
  }
  item.append(content);
  return item;
}
