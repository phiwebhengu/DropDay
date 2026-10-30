// The header floats: clear at the top of the page, then a glass capsule once content scrolls under it.
// On pages that open with full-bleed art (a game page), it also takes the dark theme's colours while it's
// clear over the art.
const header = document.querySelector('.site-header');
const overArt = header?.classList.contains('site-header--over-art');

function update() {
  const scrolled = window.scrollY > 8;
  header.classList.toggle('is-scrolled', scrolled);
  if (overArt) header.classList.toggle('theme-dark', !scrolled);
}

if (header) {
  window.addEventListener('scroll', update, { passive: true });
  update();
}
