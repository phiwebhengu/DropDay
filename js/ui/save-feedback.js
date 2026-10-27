import { getCounts } from '../store/library.js';
import { pulseBadge, squashButton } from '../motion.js';

const SAVE_BUTTONS = '.release-card__save, .status-button, .quick-view__save, #hero-save';

let total = null;

function getTotal() {
  return Object.values(getCounts()).reduce((sum, count) => sum + count, 0);
}

// A small count on every My Library link (desktop nav and the phone's bottom nav), added here so the
// four pages' markup stays the same. It's decorative: the Library page itself has the real numbers.
function createBadges() {
  return [...document.querySelectorAll('.site-nav__link[href="library.html"], .bottom-nav__link[href="library.html"]')].map(
    (link) => {
      const badge = document.createElement('span');
      badge.className = 'nav-badge';
      badge.setAttribute('aria-hidden', 'true');
      link.append(badge);
      return badge;
    },
  );
}

const badges = createBadges();

function renderBadges() {
  const next = getTotal();
  badges.forEach((badge) => {
    badge.textContent = next > 99 ? '99+' : String(next);
    badge.hidden = next === 0;
    if (total !== null && next > total) pulseBadge(badge);
  });
  total = next;
}

document.addEventListener('click', (event) => {
  const button = event.target.closest(SAVE_BUTTONS);
  if (button && !button.disabled) squashButton(button);
});

window.addEventListener('library:change', renderBadges);
renderBadges();
