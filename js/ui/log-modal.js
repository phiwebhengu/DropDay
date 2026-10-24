import * as rawg from '../api/rawg.js';
import { getEntry } from '../store/library.js';
import { saveLogEntry } from './library-actions.js';
import { formatRating } from './rating.js';

const STANDARD_EDITION = 'Standard edition';
const REVIEW_LIMIT = 2000;
const STAR_VALUES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

let dialog;
let form;
let game;
let opener;

function createDialog() {
  const element = document.createElement('dialog');
  element.className = 'log-modal';
  element.setAttribute('aria-labelledby', 'log-title');
  element.innerHTML = `
    <form class="log-modal__panel" method="dialog" novalidate>
      <span class="log-modal__handle" aria-hidden="true"></span>
      <div class="log-modal__top">
        <h2 class="log-modal__title" id="log-title"></h2>
        <button class="log-modal__close" type="button" aria-label="Close" data-close>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <fieldset class="log-modal__group">
        <legend class="visually-hidden">Status</legend>
        <div class="status-options">
          <label class="status-option">
            <input class="status-option__input" type="radio" name="status" value="played">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>
            Played
          </label>
          <label class="status-option">
            <input class="status-option__input" type="radio" name="status" value="playing">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" /></svg>
            Playing
          </label>
          <label class="status-option">
            <input class="status-option__input" type="radio" name="status" value="backlog">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" /></svg>
            Backlog
          </label>
        </div>
      </fieldset>

      <div class="field">
        <label class="field__label" for="log-platform">Platform played</label>
        <select class="field__select" id="log-platform" name="platform" autocomplete="off"></select>
      </div>

      <div class="field">
        <label class="field__label" for="log-edition">Edition</label>
        <select class="field__select" id="log-edition" name="edition" autocomplete="off"></select>
      </div>

      <fieldset class="log-modal__group">
        <legend class="field__label">Your rating</legend>
        <div class="star-input">
          <div class="star-input__stars">
            <span class="stars" aria-hidden="true">★★★★★</span>
            ${STAR_VALUES.map(
              (value, index) => `
                <label class="star-input__option" style="grid-column: ${index + 1}">
                  <input class="star-input__radio" type="radio" name="rating" value="${value}">
                  <span class="visually-hidden">${value} stars</span>
                </label>`,
            ).join('')}
          </div>
          <span class="star-input__text" aria-live="polite"></span>
          <button class="text-button star-input__clear" type="button" hidden>Clear</button>
        </div>
      </fieldset>

      <div class="field">
        <label class="field__label" for="log-review">Review (optional)</label>
        <textarea class="field__textarea" id="log-review" name="review" rows="4" maxlength="${REVIEW_LIMIT}" aria-describedby="log-review-count"></textarea>
        <span class="field__hint" id="log-review-count"></span>
      </div>

      <label class="checkbox">
        <input class="checkbox__input" type="checkbox" name="spoilers">
        Contains spoilers (hides the review behind a reveal)
      </label>

      <div class="log-modal__actions">
        <button class="button button--outline" type="button" data-close>Cancel</button>
        <button class="button button--primary" type="submit" disabled>Save log</button>
      </div>
    </form>
  `;
  document.body.append(element);
  return element;
}

function getRatingText(value) {
  return value === null ? 'No rating' : formatRating(value);
}

function getRating() {
  const checked = form.elements.rating.value;
  return checked ? Number(checked) : null;
}

function renderRating() {
  const value = getRating();
  dialog.querySelector('.star-input .stars').style.setProperty('--rating', value ?? 0);
  dialog.querySelector('.star-input__text').textContent = getRatingText(value);
  dialog.querySelector('.star-input__clear').hidden = value === null;
}

function renderReviewCount() {
  const length = form.elements.review.value.length;
  dialog.querySelector('#log-review-count').textContent = `${length}/${REVIEW_LIMIT}`;
}

function renderSaveButton() {
  form.querySelector('[type="submit"]').disabled = !form.elements.status.value;
}

function fillSelect(select, options, selected) {
  select.replaceChildren(
    ...options.map((text) => {
      const option = document.createElement('option');
      option.value = text;
      option.textContent = text;
      return option;
    }),
  );
  if (options.includes(selected)) select.value = selected;
}

// Coming from Discover with a platform picked, that platform is the likely answer, so it's preselected.
function getPlatformFromDiscover() {
  try {
    const { search } = JSON.parse(sessionStorage.getItem('dropday.discover.return'));
    const platformId = Number(new URLSearchParams(search).get('platform'));
    return game.platforms[game.platformIds.indexOf(platformId)] ?? null;
  } catch {
    return null;
  }
}

async function fillEditions(selected) {
  const select = form.elements.edition;
  fillSelect(select, [STANDARD_EDITION], STANDARD_EDITION);
  try {
    const editions = await rawg.getEditions(game.id);
    // Keep whatever the user picked while the list was loading.
    const current = select.value !== STANDARD_EDITION ? select.value : selected;
    fillSelect(select, [STANDARD_EDITION, ...editions], current ?? STANDARD_EDITION);
  } catch {
    // Standard edition is enough to log with.
  }
}

function fillForm(status) {
  const entry = getEntry(game);
  form.reset();
  dialog.querySelector('#log-title').textContent = `Log ${game.title}`;

  const presetStatus = status ?? entry?.status;
  form.elements.status.value = ['played', 'playing', 'backlog'].includes(presetStatus) ? presetStatus : '';

  fillSelect(form.elements.platform, game.platforms, entry?.platform ?? getPlatformFromDiscover());
  fillEditions(entry?.edition);

  if (entry?.rating) form.elements.rating.value = String(entry.rating);
  form.elements.review.value = entry?.review ?? '';
  form.elements.spoilers.checked = Boolean(entry?.spoilers);

  renderRating();
  renderReviewCount();
  renderSaveButton();
}

function setUpForm() {
  form = dialog.querySelector('form');

  dialog.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => opener?.focus());

  form.addEventListener('change', (event) => {
    if (event.target.name === 'rating') renderRating();
    if (event.target.name === 'status') renderSaveButton();
  });
  form.elements.review.addEventListener('input', renderReviewCount);

  // Hovering previews the rating before it's picked.
  const stars = dialog.querySelector('.star-input__stars');
  stars.addEventListener('pointerover', (event) => {
    const radio = event.target.closest('.star-input__option')?.querySelector('input');
    if (radio) stars.querySelector('.stars').style.setProperty('--rating', radio.value);
  });
  stars.addEventListener('pointerleave', renderRating);

  dialog.querySelector('.star-input__clear').addEventListener('click', () => {
    form.querySelectorAll('[name="rating"]').forEach((radio) => {
      radio.checked = false;
    });
    renderRating();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.elements.status.value) return;
    const saved = saveLogEntry(game, {
      status: form.elements.status.value,
      platform: form.elements.platform.value || null,
      edition: form.elements.edition.value || null,
      rating: getRating(),
      review: form.elements.review.value.trim(),
      spoilers: form.elements.spoilers.checked,
    });
    // On failure the error toast shows and the form stays open, so nothing typed is lost.
    if (saved) dialog.close();
  });
}

// release is the full game from the detail page (it needs platformIds); status presets Played or Playing.
export function openLogModal(release, { trigger, status } = {}) {
  if (!dialog) {
    dialog = createDialog();
    setUpForm();
  }
  game = release;
  opener = trigger;
  fillForm(status);
  dialog.showModal();
  dialog.querySelector('.log-modal__panel').scrollTop = 0;
  // Focus starts on the chosen status (or the first), per the Figma handoff note.
  (form.querySelector('[name="status"]:checked') ?? form.querySelector('[name="status"]')).focus();
}
