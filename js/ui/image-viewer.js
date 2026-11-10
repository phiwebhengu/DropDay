import { closeDialog, openDialog } from '../motion.js';

// Opens a game's screenshots full size, one at a time. Arrow keys or the buttons move between them, a
// swipe does on phones, and Escape, the close button or a tap on the dark backdrop closes it.
const SWIPE_DISTANCE = 50;

let dialog;
let opener;
let images = [];
let index = 0;
let title = '';
let closing = false;

function createDialog() {
  const element = document.createElement('dialog');
  element.className = 'image-viewer';
  element.setAttribute('aria-labelledby', 'image-viewer-title');
  element.innerHTML = `
    <div class="image-viewer__panel">
      <div class="image-viewer__head">
        <h2 class="image-viewer__title" id="image-viewer-title"></h2>
        <p class="image-viewer__count" aria-live="polite"></p>
        <button class="image-viewer__close" type="button" aria-label="Close screenshots">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="image-viewer__stage">
        <img class="image-viewer__image" alt="" draggable="false" />
        <button class="image-viewer__step image-viewer__step--prev" type="button" aria-label="Previous screenshot">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="image-viewer__step image-viewer__step--next" type="button" aria-label="Next screenshot">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
  `;
  element.querySelector('.image-viewer__close').addEventListener('click', close);
  element.querySelector('.image-viewer__step--prev').addEventListener('click', () => show(index - 1));
  element.querySelector('.image-viewer__step--next').addEventListener('click', () => show(index + 1));
  element.addEventListener('click', (event) => {
    if (event.target === element) close();
  });
  element.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  element.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(index - 1);
    if (event.key === 'ArrowRight') show(index + 1);
  });

  let swipeStart = null;
  const stage = element.querySelector('.image-viewer__stage');
  stage.addEventListener('pointerdown', (event) => {
    swipeStart = event.clientX;
  });
  stage.addEventListener('pointerup', (event) => {
    if (swipeStart === null) return;
    const distance = event.clientX - swipeStart;
    swipeStart = null;
    if (Math.abs(distance) >= SWIPE_DISTANCE) show(index + (distance < 0 ? 1 : -1));
  });

  document.body.append(element);
  return element;
}

// Wraps round at either end, so the last screenshot leads back to the first.
function show(next) {
  index = (next + images.length) % images.length;
  const image = dialog.querySelector('.image-viewer__image');
  image.src = images[index];
  image.alt = `Screenshot ${index + 1} of ${title}`;
  dialog.querySelector('.image-viewer__count').textContent = `${index + 1} of ${images.length}`;
  // The neighbours load in the background, so moving on is instant.
  [index + 1, index - 1].forEach((nearby) => {
    new Image().src = images[(nearby + images.length) % images.length];
  });
}

async function close() {
  if (closing || !dialog?.open) return;
  closing = true;
  await closeDialog(dialog, 'centre');
  dialog.close();
  closing = false;
  opener?.focus();
}

export function openImageViewer({ title: releaseTitle, images: urls, start = 0 }, trigger) {
  dialog ??= createDialog();
  opener = trigger;
  images = urls;
  title = releaseTitle;
  dialog.querySelector('.image-viewer__title').textContent = `${releaseTitle} screenshots`;
  dialog.classList.toggle('image-viewer--single', urls.length < 2);
  show(start);
  dialog.showModal();
  dialog.querySelector('.image-viewer__close').focus();
  openDialog(dialog, 'centre');
}
