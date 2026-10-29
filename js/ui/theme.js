// The header toggle switches between light and dark. Picking the theme your system already uses
// clears the saved choice, so the site goes back to following the system from then on.
// (The <head> script sets the first value before the page paints.)
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

const systemTheme = () => (systemLight.matches ? 'light' : 'dark');

toggle?.addEventListener('click', () => {
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  apply(next);
  try {
    if (next === systemTheme()) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {}
});

systemLight.addEventListener('change', () => {
  if (!readSaved()) apply(systemTheme());
});

apply(root.dataset.theme === 'light' ? 'light' : 'dark');
