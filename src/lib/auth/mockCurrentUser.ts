/**
 * Sesión del usuario.
 *  - Modo demo: sesión simulada en localStorage (elige un usuario mock por rol).
 *  - Modo backend: sesión real con cookie HTTP-only. El usuario sale de GET /auth/me.
 * La API pública (getMockCurrentUser, subscribeCurrentUser, signOut) es la misma en ambos modos,
 * así useCurrentUser y los componentes no cambian.
 */
import { API_URL, isMockApi } from '@/lib/api/config';
import { MOCK_USERS } from '@/mocks/users';
import type { Rol, Usuario } from '@/types/domain';
import { STORAGE_KEYS, readStorage, removeStorage, writeStorage } from '@/lib/storage';

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l();
}

// ------------------------------------------------------------------ estado (modo backend)

/** 'error' = el backend no respondió (distinto de «sin sesión», que es 'ready' sin usuario). */
export type SessionStatus = 'loading' | 'ready' | 'error';

let remoteUser: Usuario | null = null;
let status: SessionStatus = isMockApi ? 'ready' : 'loading';
let loading: Promise<Usuario | null> | null = null;

export function getSessionStatus(): SessionStatus {
  return status;
}

/** Carga la sesión desde GET /auth/me (una sola vez por página). */
export function loadSession(): Promise<Usuario | null> {
  if (isMockApi) return Promise.resolve(getMockCurrentUser());
  loading ??= fetch(`${API_URL}/auth/me`, { credentials: 'include' })
    .then(async (r): Promise<Usuario | null> => {
      if (r.ok) return (await r.json()) as Usuario;
      if (r.status === 401) return null;
      throw new Error(`HTTP ${r.status}`);
    })
    .then((u) => {
      remoteUser = u;
      status = 'ready';
      emit();
      return u;
    })
    .catch(() => {
      // Servidor caído o error 5xx: no es «sin sesión», no se manda al login
      remoteUser = null;
      status = 'error';
      loading = null; // permite reintentar
      emit();
      return null;
    });
  return loading;
}

/** Reintenta la conexión tras un error de red. */
export function retrySession(): Promise<Usuario | null> {
  status = 'loading';
  loading = null;
  emit();
  return loadSession();
}

/** Login real contra el backend. Devuelve el mensaje de error si falla. */
export async function signInWithPassword(email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, message: 'No se pudo conectar con el servidor' };
  }
  if (res.status === 429) return { ok: false, message: 'Demasiados intentos. Esperá un minuto y volvé a probar.' };
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
    return { ok: false, message: typeof body?.message === 'string' ? body.message : 'No se pudo iniciar sesión' };
  }
  remoteUser = (await res.json()) as Usuario;
  status = 'ready';
  loading = Promise.resolve(remoteUser);
  emit();
  return { ok: true };
}

/** El backend respondió 401 (sesión vencida): se limpia la sesión y AppShell redirige al login. */
export function handleUnauthorized(): void {
  if (isMockApi || remoteUser === null) return;
  remoteUser = null;
  loading = Promise.resolve(null); // que nadie reciba el usuario anterior desde la caché
  emit();
}

// ------------------------------------------------------------------ API común

let cachedRaw: string | null | undefined;
let cachedUser: Usuario | null = null;

export function getMockCurrentUser(): Usuario | null {
  if (!isMockApi) return remoteUser;
  const raw = readStorage(STORAGE_KEYS.session);
  if (raw === cachedRaw) return cachedUser;
  cachedRaw = raw;
  cachedUser = MOCK_USERS.find((u) => u.id === raw) ?? null;
  return cachedUser;
}

/** Solo modo demo: cambia al usuario mock indicado. */
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

export async function signOut(): Promise<void> {
  if (isMockApi) {
    removeStorage(STORAGE_KEYS.session);
  } else {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined);
    remoteUser = null;
    loading = Promise.resolve(null);
  }
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
