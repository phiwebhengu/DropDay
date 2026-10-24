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

// It starts from the loading state: the eyebrow, buttons, "--" countdown and a grey art panel are already
// there, so nothing jumps or blinks out. Only the new content arrives: art, title, date, then the digits.
export function playHeroIntro(hero) {
  return withMotion(({ full }) => {
    const arriving = hero.querySelectorAll('.hero__title, .hero__meta, .countdown__value');
    if (!full) {
      fadeIn(arriving);
      return;
    }
    const art = hero.querySelector('.hero__art');
    const reveal = art.querySelector('img') ?? art;
    gsap
      .timeline({ defaults: { ease: 'power3.out' } })
      .fromTo(
        reveal,
        { clipPath: 'inset(0% 0% 0% 100% round 20px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 20px)', duration: 1.2, ease: 'power3.inOut', clearProps: 'clipPath' },
        0,
      )
      .from(reveal, { scale: 1.18, duration: 1.6 }, 0)
      .from(hero.querySelector('.hero__title'), { yPercent: 35, opacity: 0, filter: 'blur(10px)', duration: 0.9, clearProps: 'filter' }, 0.1)
      .from(hero.querySelector('.hero__meta'), { y: 12, opacity: 0, duration: 0.6 }, 0.3)
      .from(hero.querySelectorAll('.countdown__value'), { yPercent: -80, opacity: 0, duration: 0.6, stagger: 0.08 }, 0.45);
  }, ['full', 'reduced']);
}

// The old number rolls out downwards as the new one drops in. Reduced motion just swaps the number:
// a fade every second would be noise.
export function tickDigit(element, previous) {
  if (!hasMotion || prefersReducedMotion()) return;
  const ghost = element.cloneNode();
  ghost.classList.add('countdown__value--ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.textContent = previous;
  element.after(ghost);

  const roll = { duration: 0.35, ease: 'power2.inOut' };
  gsap.to(ghost, { yPercent: 70, opacity: 0, ...roll, onComplete: () => ghost.remove() });
  gsap.fromTo(element, { yPercent: -70, opacity: 0 }, { yPercent: 0, opacity: 1, ...roll });
}

/* M2 · "Dropping this month": on desktop the section pins and vertical scroll drives the strip sideways.
   Below 1024 px, and with reduced motion, it stays a native swipe row with scroll-snap. */

export function setupPinnedStrip(section, strip, progress) {
  return withMotion(({ full, desktop }) => {
    const distance = () => strip.scrollWidth - strip.clientWidth;
    if (!full || !desktop || distance() <= 0) return undefined;

    strip.classList.add('release-strip--pinned');
    progress.hidden = false;
    const header = document.querySelector('.site-header');

    const slide = gsap.to(strip, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: () => `top ${header.offsetHeight + 24}px`,
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => gsap.set(progress.firstElementChild, { scaleX: self.progress }),
      },
    });

    // Cards still off to the right sit back slightly and come forward as they slide in.
    [...strip.children].forEach((card) => {
      gsap.from(card, {
        scale: 0.9,
        opacity: 0.35,
        ease: 'power2.out',
        scrollTrigger: { trigger: card, containerAnimation: slide, start: 'left right', end: 'left 75%', scrub: true },
      });
    });

    // Tabbing to a card that's still off screen scrolls the page to the point where it's in view.
    const onFocus = (event) => {
      const card = event.target.closest('.release-strip > li');
      if (!card) return;
      const trigger = slide.scrollTrigger;
      const share = Math.min(1, Math.max(0, (card.offsetLeft - strip.clientWidth / 2 + card.offsetWidth / 2) / distance()));
      window.scrollTo({ top: trigger.start + share * (trigger.end - trigger.start), behavior: 'instant' });
    };
    strip.addEventListener('focusin', onFocus);

    return () => {
      strip.classList.remove('release-strip--pinned');
      progress.hidden = true;
      strip.removeEventListener('focusin', onFocus);
    };
  });
}
