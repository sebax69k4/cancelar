/**
 * Acceso seguro a localStorage (puede fallar en modo privado o con almacenamiento bloqueado).
 * Solo guarda preferencias de este navegador (el tema): los datos viven en el servidor.
 */
export const STORAGE_KEYS = {
  theme: 'st.theme',
} as const;

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* sin almacenamiento disponible: la preferencia dura hasta recargar */
  }
}
