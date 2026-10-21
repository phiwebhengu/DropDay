const HIDE_AFTER = 5000;

const ICONS = {
  success: '✓',
  error: '!',
};

let current = null;

function createAction(tag, label) {
  const action = document.createElement(tag);
  action.className = 'toast__action';
  action.textContent = label;
  if (tag === 'button') action.type = 'button';
  return action;
}

function hide(toast) {
  if (!toast.isConnected) return;
  clearTimeout(toast.timer);
  toast.classList.add('toast--leaving');
  // Wait for the fade; the timeout covers reduced motion, where no animation runs.
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
  setTimeout(() => toast.remove(), 300);
  if (current === toast) current = null;
}

function startTimer(toast) {
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => hide(toast), HIDE_AFTER);
}

// One toast at a time: a new message replaces the last, so quick saves don't stack up a pile.
export function showToast({ message, type = 'success', viewHref, onUndo }) {
  // An open dialog makes the rest of the page inert, so toasts go to the dialog's own region while it's open.
  const region = document.querySelector('dialog[open] .toast-region') ?? document.querySelector('.toast-region');
  if (!region) return;
  if (current) hide(current);

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const icon = document.createElement('span');
  icon.className = 'toast__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = ICONS[type];

  const text = document.createElement('p');
  text.className = 'toast__message';
  text.textContent = message;

  toast.append(icon, text);

  if (viewHref) {
    const view = createAction('a', 'View');
    view.href = viewHref;
    toast.append(view);
  }

  if (onUndo) {
    const undo = createAction('button', 'Undo');
    undo.addEventListener('click', () => {
      hide(toast);
      onUndo();
    });
    toast.append(undo);
  }

  // Keep it on screen while someone is reading it or about to press an action (WCAG 2.2.1).
  toast.addEventListener('mouseenter', () => clearTimeout(toast.timer));
  toast.addEventListener('mouseleave', () => startTimer(toast));
  toast.addEventListener('focusin', () => clearTimeout(toast.timer));
  toast.addEventListener('focusout', () => startTimer(toast));

  region.append(toast);
  current = toast;
  startTimer(toast);
}
