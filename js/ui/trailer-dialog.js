import { closeDialog, openDialog } from '../motion.js';

// "Watch trailer": the whole trailer, uncropped, with the player's own controls and sound (testers 4 and
// 6 wanted to pause it and see it without text over it). The billboard preview behind stays silent.
let dialog;
let opener;
let closing = false;

function createDialog() {
  const element = document.createElement('dialog');
  element.className = 'trailer-dialog';
  element.setAttribute('aria-labelledby', 'trailer-dialog-title');
  element.innerHTML = `
    <div class="trailer-dialog__panel">
      <div class="trailer-dialog__head">
        <h2 class="trailer-dialog__title" id="trailer-dialog-title"></h2>
        <button class="trailer-dialog__close" type="button" aria-label="Close trailer">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="trailer-dialog__frame"></div>
    </div>
  `;
  element.querySelector('.trailer-dialog__close').addEventListener('click', close);
  // A click on the dark backdrop (the dialog itself, outside the panel) closes it.
  element.addEventListener('click', (event) => {
    if (event.target === element) close();
  });
  element.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  document.body.append(element);
  return element;
}

function createPlayer({ youtubeId, src }, title) {
  if (youtubeId) {
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?autoplay=1&rel=0&playsinline=1`;
    frame.title = `${title} trailer`;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    return frame;
  }
  const video = document.createElement('video');
  video.src = src;
  video.controls = true;
  video.autoplay = true;
  video.playsInline = true;
  return video;
}

async function close() {
  if (closing || !dialog?.open) return;
  closing = true;
  await closeDialog(dialog, 'centre');
  // Removing the player stops the sound straight away.
  dialog.querySelector('.trailer-dialog__frame').replaceChildren();
  dialog.close();
  closing = false;
  opener?.focus();
}

export function openTrailerDialog({ title, trailer }, trigger) {
  dialog ??= createDialog();
  opener = trigger;
  dialog.querySelector('.trailer-dialog__title').textContent = `${title} trailer`;
  dialog.querySelector('.trailer-dialog__frame').replaceChildren(createPlayer(trailer, title));
  dialog.showModal();
  dialog.querySelector('.trailer-dialog__close').focus();
  openDialog(dialog, 'centre');
}
