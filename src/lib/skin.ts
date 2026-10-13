import { readStorage, writeStorage } from './storage';

/** Estilo visual: clásico (Windows 2000 / Terminal CRT) o moderno. */
export type Skin = 'classic' | 'modern';

export const SKIN_KEY = 'st.skin';
export const DEFAULT_SKIN: Skin = 'classic';

export function getSkin(): Skin {
  const v = readStorage(SKIN_KEY);
  return v === 'modern' || v === 'classic' ? v : DEFAULT_SKIN;
}

export function applySkin(skin: Skin): void {
  writeStorage(SKIN_KEY, skin);
  document.documentElement.classList.toggle('skin-classic', skin === 'classic');
}
