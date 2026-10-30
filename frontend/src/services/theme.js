// Gerenciamento do tema visual (Verde UFABC vs Orgulho LGBT+ Pride)

const themeListeners = new Set();
const VALID_THEMES = ['ufabc', 'pride', 'halloween'];

export function onThemeChange(listener) {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

export function getStoredTheme() {
  if (typeof localStorage !== 'undefined') {
    const t = localStorage.getItem('pontinho_theme');
    if (VALID_THEMES.includes(t)) return t;
  }
  return 'ufabc';
}

export function applyTheme(theme) {
  const chosen = VALID_THEMES.includes(theme) ? theme : 'ufabc';
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('theme-pride', 'theme-halloween');
    if (chosen === 'pride') {
      document.documentElement.classList.add('theme-pride');
    } else if (chosen === 'halloween') {
      document.documentElement.classList.add('theme-halloween');
    }
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('pontinho_theme', chosen);
  }
  themeListeners.forEach((fn) => {
    try {
      fn(chosen);
    } catch (_) {}
  });
}
