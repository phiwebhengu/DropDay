// The header toggle switches between light and dark and remembers the choice on this device.
// Until someone picks, the site follows the system setting (the <head> script sets the first value).
const STORAGE_KEY = 'dropday.theme';
const BROWSER_BAR_COLOURS = { dark: '#141311', light: '#f3efe8' };

const root = document.documentElement;
const toggle = document.getElementById('theme-toggle');
const systemLight = matchMedia('(prefers-color-scheme: light)');

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function apply(theme) {
  root.dataset.theme = theme;
  toggle?.setAttribute('aria-pressed', String(theme === 'light'));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BROWSER_BAR_COLOURS[theme]);
}

toggle?.addEventListener('click', () => {
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  apply(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {}
});

systemLight.addEventListener('change', (event) => {
  if (!readSaved()) apply(event.matches ? 'light' : 'dark');
});

apply(root.dataset.theme === 'light' ? 'light' : 'dark');
