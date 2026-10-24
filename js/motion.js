// Motion moments M1–M5 (PRD §4). GSAP loads from cdnjs as a global, only on the pages that use it.
// If the CDN fails, every page still works; it just doesn't animate.
const { gsap } = window;

export const hasMotion = Boolean(gsap);

const QUERIES = {
  full: '(prefers-reduced-motion: no-preference)',
  reduced: '(prefers-reduced-motion: reduce)',
  desktop: '(min-width: 1024px)',
};

if (hasMotion) {
  gsap.registerPlugin(...[window.ScrollTrigger, window.Flip].filter(Boolean));
  gsap.defaults({ duration: 0.4, ease: 'power2.out' });
}

// Every moment goes through here. setup gets { full, reduced, desktop } and runs again whenever those change,
// with GSAP undoing the previous version first. Reduced motion swaps transforms, pins and scrubs for short fades.
// keys picks which conditions matter: a one-off entrance shouldn't replay just because the window crossed 1024 px.
export function withMotion(setup, keys = Object.keys(QUERIES)) {
  if (!hasMotion) return null;
  const media = gsap.matchMedia();
  const queries = Object.fromEntries(keys.map((key) => [key, QUERIES[key]]));
  media.add(queries, (context) => setup(context.conditions));
  return media;
}

// The reduced-motion stand-in for any entrance: a 0.2 s opacity fade, nothing moves.
export function fadeIn(targets, vars = {}) {
  return gsap.from(targets, { opacity: 0, duration: 0.2, ease: 'none', ...vars });
}

function prefersReducedMotion() {
  return window.matchMedia(QUERIES.reduced).matches;
}

/* M1 · Home hero: the featured launch builds in (1.2 s, power3.out), then the countdown digits tick. */

export function playHeroIntro(hero) {
  return withMotion(({ full }) => {
    if (!full) {
      fadeIn(hero.querySelector('.hero__content'));
      return;
    }
    const lines = hero.querySelectorAll('.hero__eyebrow, .hero__title, .hero__meta, .hero__actions');
    const units = hero.querySelectorAll('.countdown__unit');
    gsap
      .timeline({ defaults: { ease: 'power3.out' } })
      .from(lines, { y: 24, opacity: 0, duration: 0.7, stagger: 0.08 }, 0)
      .from(units, { y: 16, opacity: 0, duration: 0.5, stagger: 0.06 }, 0.3)
      .from(hero.querySelector('.hero__art'), { opacity: 0, scale: 1.06, duration: 1.2 }, 0);
  }, ['full', 'reduced']);
}

// The new number drops in from above. Reduced motion just swaps the number: a fade every second would be noise.
export function tickDigit(element) {
  if (!hasMotion || prefersReducedMotion()) return;
  gsap.fromTo(element, { yPercent: -45, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.35, ease: 'power2.inOut' });
}
