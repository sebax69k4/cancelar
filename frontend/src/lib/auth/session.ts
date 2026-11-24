/**
 * Sesión del usuario: cookie HTTP-only que maneja el backend. El usuario sale de GET /auth/me.
 * useCurrentUser se suscribe a este módulo; los componentes no hablan con fetch directamente.
 */
import { API_URL } from '@/lib/api/config';
import type { Usuario } from '@/types/domain';

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l();
}

/** 'error' = el backend no respondió (distinto de «sin sesión», que es 'ready' sin usuario). */
export type SessionStatus = 'loading' | 'ready' | 'error';

let currentUser: Usuario | null = null;
let status: SessionStatus = 'loading';
let loading: Promise<Usuario | null> | null = null;

export function getSessionStatus(): SessionStatus {
  return status;
}

export function getCurrentUser(): Usuario | null {
  return currentUser;
}

/** Carga la sesión desde GET /auth/me (una sola vez por página). */
export function loadSession(): Promise<Usuario | null> {
  loading ??= fetch(`${API_URL}/auth/me`, { credentials: 'include' })
    .then(async (r): Promise<Usuario | null> => {
      if (r.ok) return (await r.json()) as Usuario;
      if (r.status === 401) return null;
      throw new Error(`HTTP ${r.status}`);
    })
    .then((u) => {
      currentUser = u;
      status = 'ready';
      emit();
      return u;
    })
    .catch(() => {
      // Servidor caído o error 5xx: no es «sin sesión», no se manda al login
      currentUser = null;
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

type Resultado = { ok: true } | { ok: false; message: string };

/** POST con la cookie de sesión; deja la sesión iniciada si responde bien. */
async function postSesion(ruta: string, body: unknown, errorPorDefecto: string): Promise<Resultado> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${ruta}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: 'No se pudo conectar con el servidor' };
  }
  if (res.status === 429) return { ok: false, message: 'Demasiados intentos. Esperá un minuto y volvé a probar.' };
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: unknown } | null;
    const m = data?.message;
    return { ok: false, message: typeof m === 'string' ? m : Array.isArray(m) ? m.join('. ') : errorPorDefecto };
  }
  currentUser = (await res.json()) as Usuario;
  status = 'ready';
  loading = Promise.resolve(currentUser);
  emit();
  return { ok: true };
}

/** Inicia sesión. Devuelve el mensaje de error si falla. */
export function signInWithPassword(email: string, password: string): Promise<Resultado> {
  return postSesion('/auth/login', { email, password }, 'No se pudo iniciar sesión');
}

/** Crea el taller y su Admin, y deja la sesión iniciada. */
export function signUp(input: { tallerNombre: string; nombre: string; email: string; password: string }): Promise<Resultado> {
  return postSesion('/auth/register', input, 'No se pudo crear la cuenta');
}

/** El backend respondió 401 (sesión vencida): se limpia la sesión y AppShell redirige al login. */
export function handleUnauthorized(): void {
  if (currentUser === null) return;
  currentUser = null;
  loading = Promise.resolve(null); // que nadie reciba el usuario anterior desde la caché
  emit();
}

export async function signOut(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined);
  currentUser = null;
  loading = Promise.resolve(null);
  emit();
}

export function subscribeCurrentUser(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
