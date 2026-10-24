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
export function withMotion(setup) {
  if (!hasMotion) return null;
  const media = gsap.matchMedia();
  media.add(QUERIES, (context) => setup(context.conditions));
  return media;
}

// The reduced-motion stand-in for any entrance: a 0.2 s opacity fade, nothing moves.
export function fadeIn(targets, vars = {}) {
  return gsap.from(targets, { opacity: 0, duration: 0.2, ease: 'none', ...vars });
}
