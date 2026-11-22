// Light ("paper") is the default; dark is opt-in and remembered. The initial theme is applied by an inline
// script in <head> so there's no flash; this wires up the toggle button.
export const isDark = () => document.documentElement.dataset.theme === 'dark';

export function initThemeToggle(onChange) {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const sync = () => {
    const dark = isDark();
    btn.textContent = dark ? '☀' : '☾';
    const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
    btn.setAttribute('aria-label', label);
    btn.title = label;
  };
  btn.addEventListener('click', () => {
    const dark = !isDark();
    if (dark) document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) { /* private mode: fine */ }
    sync();
    if (onChange) onChange(dark);
  });
  sync();
}
