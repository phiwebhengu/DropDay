// On pages that open with full-bleed art, the header starts clear over it and frosts once the page scrolls.
const header = document.querySelector('.site-header--over-art');

// While it's clear over the art it takes the dark theme's colours, whatever the page theme is.
function update() {
  const scrolled = window.scrollY > 24;
  header.classList.toggle('is-scrolled', scrolled);
  header.classList.toggle('theme-dark', !scrolled);
}

if (header) {
  window.addEventListener('scroll', update, { passive: true });
  update();
}
