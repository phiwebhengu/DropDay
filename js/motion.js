// Motion moments M1–M5 (PRD §4). GSAP loads from cdnjs as a global, only on the pages that use it.
// If the CDN fails, every page still works; it just doesn't animate.
const { gsap } = window;

export const hasMotion = Boolean(gsap);

const QUERIES = {
  full: "(prefers-reduced-motion: no-preference)",
  reduced: "(prefers-reduced-motion: reduce)",
  desktop: "(min-width: 1024px)",
};

if (hasMotion) {
  document.documentElement.classList.add("has-motion");
  gsap.registerPlugin(...[window.ScrollTrigger, window.Flip].filter(Boolean));
  gsap.defaults({ duration: 0.4, ease: "power2.out" });
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
  return gsap.from(targets, {
    opacity: 0,
    duration: 0.2,
    ease: "none",
    ...vars,
  });
}

function prefersReducedMotion() {
  return window.matchMedia(QUERIES.reduced).matches;
}

/* M1 · Home hero: the featured launch builds in (1.2 s, power3.out), then the countdown digits tick. */

// It starts from the loading state: the eyebrow, buttons, "--" countdown and a grey art panel are already
// there, so nothing jumps or blinks out. Only the new content arrives: art, title, date, then the digits.
export function playHeroIntro(hero) {
  return withMotion(
    ({ full }) => {
      const arriving = hero.querySelectorAll(
        ".hero__title, .hero__meta, .countdown__value",
      );
      if (!full) {
        fadeIn(arriving);
        return;
      }
      const media = hero.querySelector(".hero__media");
      const reveal = media.querySelector("img") ?? media;
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .fromTo(
          reveal,
          { clipPath: "inset(0% 0% 0% 100%)" },
          {
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 1.2,
            ease: "power3.inOut",
            clearProps: "clipPath",
          },
          0,
        )
        .from(reveal, { scale: 1.12, duration: 1.8 }, 0)
        .from(
          hero.querySelector(".hero__title"),
          {
            yPercent: 35,
            opacity: 0,
            filter: "blur(10px)",
            duration: 0.9,
            clearProps: "filter",
          },
          0.1,
        )
        .from(
          hero.querySelector(".hero__meta"),
          { y: 12, opacity: 0, duration: 0.6 },
          0.3,
        )
        .from(
          hero.querySelectorAll(".countdown__value"),
          { yPercent: -80, opacity: 0, duration: 0.6, stagger: 0.08 },
          0.45,
        );
    },
    ["full", "reduced"],
  );
}

// The old number rolls out downwards as the new one drops in. Reduced motion just swaps the number:
// a fade every second would be noise.
export function tickDigit(element, previous) {
  if (!hasMotion || prefersReducedMotion()) return;
  const ghost = element.cloneNode();
  ghost.classList.add("countdown__value--ghost");
  ghost.setAttribute("aria-hidden", "true");
  ghost.textContent = previous;
  element.after(ghost);

  const roll = { duration: 0.35, ease: "power2.inOut" };
  gsap.to(ghost, {
    yPercent: 70,
    opacity: 0,
    ...roll,
    onComplete: () => ghost.remove(),
  });
  gsap.fromTo(
    element,
    { yPercent: -70, opacity: 0 },
    { yPercent: 0, opacity: 1, ...roll },
  );
}

/* M2 · Home billboard: moving to the next featured release, the new art fades up out of a slight zoom
   (1.1 s) while its title, details and buttons rise in on a short stagger. Reduced motion: a plain fade.
   It replaces the pinned horizontal strip, which testers found trapped their scrolling (#76). */

export function swapBillboard(image, content) {
  if (!hasMotion) return;
  const parts = [...content.children].filter((part) => !part.hidden);
  if (prefersReducedMotion()) {
    fadeIn([image, ...parts], { duration: 0.3 });
    return;
  }
  gsap
    .timeline({ defaults: { ease: "power3.out" } })
    .fromTo(image, { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 1.1, ease: "power2.out" })
    .from(parts, { y: 16, opacity: 0, duration: 0.6, stagger: 0.06, clearProps: "transform,opacity" }, 0.15);
}

/* M3 · Discover grid: when filters change, releases that stay glide to their new places (Flip),
   new ones rise in on a short stagger. Reduced motion: the new cards fade in. */

export function captureGrid(grid) {
  if (!hasMotion || !window.Flip) return null;
  return window.Flip.getState(
    grid.querySelectorAll(".release-card[data-flip-id]"),
  );
}

function enterCards(cards) {
  return gsap.from(cards, {
    opacity: 0,
    y: 24,
    scale: 0.96,
    duration: 0.55,
    ease: "power3.out",
    stagger: { each: 0.03, amount: 0.5 },
    clearProps: "opacity,transform",
  });
}

export function animateGrid(cards, state = null) {
  if (!hasMotion || !cards.length) return;
  if (prefersReducedMotion()) {
    fadeIn(cards);
    return;
  }
  if (!state || !window.Flip) {
    enterCards(cards);
    return;
  }
  window.Flip.from(state, {
    targets: cards,
    duration: 0.6,
    ease: "power3.inOut",
    stagger: 0.015,
    onEnter: enterCards,
  });
}

/* M4 · Save feedback: the button squashes and springs back, the toast arrives with a little overshoot,
   and the Library badge in the nav pulses. Reduced motion keeps the state changes, without the bounce. */

// One press and one overshoot (back.out), not an elastic wobble, and force3D off so the browser redraws
// the pill crisply at each step instead of scaling a GPU snapshot of it (that's what blurred the corners).
export function squashButton(button) {
  if (!hasMotion || prefersReducedMotion()) return;
  gsap.killTweensOf(button);
  gsap
    .timeline({ defaults: { force3D: false } })
    .to(button, { scale: 0.93, duration: 0.1, ease: "power2.out" })
    .to(button, {
      scale: 1,
      duration: 0.45,
      ease: "back.out(2.5)",
      clearProps: "transform",
    });
}

// Returns true when GSAP handled the entrance, so the toast can switch off its CSS fallback.
export function animateToastIn(toast) {
  if (!hasMotion || prefersReducedMotion()) return false;
  gsap.from(toast, {
    y: 32,
    scale: 0.94,
    opacity: 0,
    duration: 0.5,
    ease: "back.out(1.6)",
    clearProps: "transform,opacity",
  });
  return true;
}

export function pulseBadge(badge) {
  if (!hasMotion || prefersReducedMotion()) return;
  gsap.fromTo(
    badge,
    { scale: 1.6 },
    {
      scale: 1,
      duration: 0.5,
      ease: "back.out(2)",
      force3D: false,
      clearProps: "transform",
    },
  );
}

/* M5 · Dialogs and the Library count-up.
   The log modal rises as a bottom sheet on phones and settles in the centre on desktop; the quick view
   slides in from the right on desktop. Each closes the way it came. Reduced motion: short fades. */

// The dialogs move through CSS variables (see .log-modal / .quick-view in components.css), not GSAP's x/y:
// GSAP briefly re-attaches an element to measure its transform, and doing that to an open modal <dialog>
// knocks it out of the top layer, so Esc and the backdrop stop working.
const DIALOG_ORIGINS = {
  bottom: { "--dialog-y": "100%" },
  right: { "--dialog-x": "100%" },
  centre: { "--dialog-y": "4%", "--dialog-scale": 0.96, opacity: 0 },
};

const DIALOG_REST = {
  "--dialog-x": "0%",
  "--dialog-y": "0%",
  "--dialog-scale": 1,
  opacity: 1,
};

export function openDialog(dialog, origin) {
  if (!hasMotion) return;
  gsap.killTweensOf(dialog);
  gsap.set(dialog, DIALOG_REST);
  if (prefersReducedMotion()) {
    gsap.from(dialog, { opacity: 0, duration: 0.2, ease: "none" });
    return;
  }
  gsap
    .timeline()
    .from(dialog, {
      ...DIALOG_ORIGINS[origin],
      duration: 0.5,
      ease: "power3.out",
    })
    .from(
      dialog.querySelectorAll("[data-reveal]"),
      {
        y: 12,
        opacity: 0,
        duration: 0.4,
        stagger: 0.04,
        ease: "power2.out",
        clearProps: "transform,opacity",
      },
      0.12,
    );
}

// Resolves once the dialog has animated away, so the caller can then really close it.
export function closeDialog(dialog, origin) {
  if (!hasMotion) return Promise.resolve();
  gsap.killTweensOf(dialog);
  const exit = prefersReducedMotion()
    ? { opacity: 0, duration: 0.15, ease: "none" }
    : { ...DIALOG_ORIGINS[origin], duration: 0.3, ease: "power2.in" };
  return new Promise((resolve) => {
    gsap.to(dialog, { ...exit, onComplete: resolve });
  });
}

// Counts up from where it was (0 on first view) to the new number.
export function countTo(element, value) {
  const from = Number(element.dataset.shown ?? 0);
  element.dataset.shown = value;
  if (!hasMotion || prefersReducedMotion() || from === value) {
    element.textContent = value;
    return;
  }
  const counter = { value: from };
  gsap.to(counter, {
    value,
    duration: Math.min(1.2, 0.5 + Math.abs(value - from) * 0.03),
    ease: "power2.out",
    onUpdate: () => {
      element.textContent = Math.round(counter.value);
    },
  });
}
