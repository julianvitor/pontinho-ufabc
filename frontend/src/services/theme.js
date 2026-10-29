// Gerenciamento do tema visual (Verde UFABC vs Orgulho LGBT+ Pride)

const themeListeners = new Set();

export function onThemeChange(listener) {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

export function getStoredTheme() {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('pontinho_theme') || 'ufabc';
  }
  return 'ufabc';
}

export function applyTheme(theme) {
  const isPride = theme === 'pride';
  if (typeof document !== 'undefined') {
    if (isPride) {
      document.documentElement.classList.add('theme-pride');
    } else {
      document.documentElement.classList.remove('theme-pride');
    }
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('pontinho_theme', isPride ? 'pride' : 'ufabc');
  }
  themeListeners.forEach((fn) => {
    try {
      fn(isPride ? 'pride' : 'ufabc');
    } catch (_) {}
  });
}
