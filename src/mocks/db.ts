/**
 * "Base de datos" de la demo, persistida en localStorage. Arranca VACÍA.
 * Solo la usa src/lib/api/apiClient.ts; ningún componente debe importarla.
 */
import { STORAGE_KEYS, readStorage, removeStorage, writeStorage } from '@/lib/storage';
import type { Cliente, Equipo, Orden } from '@/types/domain';

const VERSION = 1;

export interface DbState {
  version: typeof VERSION;
  /** Correlativo para el número de orden (OS-AAAA-0001). */
  seq: number;
  clientes: Cliente[];
  equipos: Equipo[];
  ordenes: Orden[];
  /** Ids de InformeCritico marcados como leídos. */
  informesLeidos: string[];
}

function emptyDb(): DbState {
  return { version: VERSION, seq: 0, clientes: [], equipos: [], ordenes: [], informesLeidos: [] };
}

function isDbState(value: unknown): value is DbState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === VERSION &&
    typeof v.seq === 'number' &&
    Array.isArray(v.clientes) &&
    Array.isArray(v.equipos) &&
    Array.isArray(v.ordenes) &&
    Array.isArray(v.informesLeidos)
  );
}

function load(): DbState {
  const raw = readStorage(STORAGE_KEYS.db);
  if (!raw) return emptyDb();
  try {
    const parsed: unknown = JSON.parse(raw);
    return isDbState(parsed) ? parsed : emptyDb();
  } catch {
    return emptyDb();
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();
let state: DbState | null = null;

function emit(): void {
  for (const l of listeners) l();
}

export function getDb(): Readonly<DbState> {
  state ??= load();
  return state;
}

/** Aplica una mutación sobre una copia, la persiste y notifica. */
export function updateDb<T>(mutator: (draft: DbState) => T): T {
  const draft = structuredClone(getDb());
  const result = mutator(draft);
  state = draft;
  writeStorage(STORAGE_KEYS.db, JSON.stringify(draft));
  emit();
  return result;
}

export function resetDb(): void {
  state = emptyDb();
  removeStorage(STORAGE_KEYS.db);
  emit();
}

export function subscribeDb(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Sincroniza entre pestañas abiertas.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEYS.db) {
      state = load();
      emit();
    }
  });
}
