/**
 * Router mínimo para navegar dentro de la app sin recargar la página.
 * Las URLs siguen siendo reales (Astro sirve cada ruta), así que recargar, abrir en
 * pestaña nueva o compartir un enlace funciona igual. Solo cambia la navegación interna:
 * se actualiza el historial y React cambia el contenido, conservando sesión y datos en caché.
 */

export interface RouteState {
  pathname: string;
  search: string;
  hash: string;
  /** Se incrementa en cada navegación: fuerza a remontar la página aunque la ruta sea la misma. */
  key: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();

let state: RouteState = readLocation(0);
let mounted = false;

function readLocation(key: number): RouteState {
  if (typeof window === 'undefined') return { pathname: '/', search: '', hash: '', key };
  return { pathname: window.location.pathname, search: window.location.search, hash: window.location.hash, key };
}

function emit(): void {
  for (const l of listeners) l();
}

export function getRoute(): RouteState {
  return state;
}

export function subscribeRoute(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Rutas que resuelve la app (el resto, ej. /login, navega con recarga normal). */
const APP_ROUTE = /^\/(dashboard|alertas|clientes|equipos|design|ordenes(\/nueva|\/[^/]+)?)\/?$/;

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTE.test(pathname);
}

/** La isla App llama a esto al montar: desde ahí las navegaciones internas no recargan. */
export function setRouterMounted(value: boolean): void {
  mounted = value;
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const url = new URL(to, window.location.href);
  if (!mounted || url.origin !== window.location.origin || !isAppRoute(url.pathname)) {
    if (opts.replace) window.location.replace(url.href);
    else window.location.assign(url.href);
    return;
  }
  const target = url.pathname + url.search + url.hash;
  if (opts.replace) window.history.replaceState(null, '', target);
  else window.history.pushState(null, '', target);
  state = readLocation(state.key + 1);
  emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (!mounted) return;
    if (!isAppRoute(window.location.pathname)) {
      window.location.reload();
      return;
    }
    state = readLocation(state.key + 1);
    emit();
  });
}
