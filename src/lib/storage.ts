/**
 * Acceso seguro a localStorage (puede fallar en modo privado o con almacenamiento bloqueado).
 * En la versión demo TODO se guarda en el navegador: sesión mock, tema y datos de negocio.
 */
export const STORAGE_KEYS = {
  theme: 'st.theme',
  session: 'st.session',
  db: 'st.db.v1',
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
    /* sin almacenamiento disponible: la demo sigue funcionando en memoria */
  }
}

export function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignorado */
  }
}
