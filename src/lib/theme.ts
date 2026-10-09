import { STORAGE_KEYS, readStorage, writeStorage } from './storage';

export type ThemePreference = 'light' | 'dark' | 'system';

export function getThemePreference(): ThemePreference {
  const value = readStorage(STORAGE_KEYS.theme);
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(pref: ThemePreference): void {
  writeStorage(STORAGE_KEYS.theme, pref);
  document.documentElement.classList.toggle('dark', resolveTheme(pref) === 'dark');
}
