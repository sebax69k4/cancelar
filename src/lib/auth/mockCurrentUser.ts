/**
 * Sesión simulada. NO es autenticación: solo guarda qué usuario mock está "logueado".
 * Al conectar NestJS se reemplaza por el usuario devuelto por /auth/me (cookie HTTP-only).
 */
import { MOCK_USERS } from '@/mocks/users';
import type { Rol, Usuario } from '@/types/domain';
import { STORAGE_KEYS, readStorage, removeStorage, writeStorage } from '@/lib/storage';

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedRaw: string | null | undefined;
let cachedUser: Usuario | null = null;

function emit(): void {
  for (const l of listeners) l();
}

export function getMockCurrentUser(): Usuario | null {
  const raw = readStorage(STORAGE_KEYS.session);
  if (raw === cachedRaw) return cachedUser;
  cachedRaw = raw;
  cachedUser = MOCK_USERS.find((u) => u.id === raw) ?? null;
  return cachedUser;
}

export function signInAs(userId: string): Usuario | null {
  const user = MOCK_USERS.find((u) => u.id === userId) ?? null;
  if (user) {
    writeStorage(STORAGE_KEYS.session, user.id);
    emit();
  }
  return user;
}

export function firstUserWithRole(rol: Rol): Usuario {
  const user = MOCK_USERS.find((u) => u.rol === rol);
  if (!user) throw new Error(`No hay usuario mock con rol ${rol}`);
  return user;
}

export function signOut(): void {
  removeStorage(STORAGE_KEYS.session);
  emit();
}

export function subscribeCurrentUser(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEYS.session) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}
