// On pages that open with full-bleed art, the header starts clear over it and frosts once the page scrolls.
const header = document.querySelector('.site-header--over-art');

function update() {
  header.classList.toggle('is-scrolled', window.scrollY > 24);
}

if (header) {
  window.addEventListener('scroll', update, { passive: true });
  update();
}
