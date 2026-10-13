/**
 * Isla única de la app: resuelve la ruta actual y cambia de pantalla sin recargar.
 * Sesión, caché de datos y estado de la UI se conservan entre pantallas, así que al
 * navegar se ve el contenido al instante (con los datos ya descargados o precargados).
 */
import { Fragment, useEffect, useRef, useSyncExternalStore, type ReactElement } from 'react';
import { NAV_ITEMS } from '@/components/layout/nav';
import { prefetchRoute } from '@/lib/api/prefetch';
import { loadSession } from '@/lib/auth/mockCurrentUser';
import { can } from '@/lib/auth/permissions';
import { getRoute, isAppRoute, navigate, setRouterMounted, subscribeRoute, type RouteState } from '@/lib/router';
import AlertsPage from './AlertsPage';
import ClientsPage from './ClientsPage';
import DashboardPage from './DashboardPage';
import DesignSystemPage from './DesignSystemPage';
import EquipmentPage from './EquipmentPage';
import NewOrderPage from './NewOrderPage';
import OrderDetailPage from './OrderDetailPage';
import OrdersBoardPage from './OrdersBoardPage';

interface Resolved {
  title: string;
  element: ReactElement;
}

function resolve(route: RouteState): Resolved | null {
  const p = route.pathname.replace(/\/$/, '') || '/';
  switch (p) {
    case '/dashboard':
      return { title: 'Dashboard', element: <DashboardPage /> };
    case '/ordenes':
      return { title: 'Órdenes', element: <OrdersBoardPage /> };
    case '/ordenes/nueva':
      return { title: 'Nueva orden', element: <NewOrderPage /> };
    case '/clientes':
      return { title: 'Clientes', element: <ClientsPage /> };
    case '/equipos':
      return { title: 'Equipos', element: <EquipmentPage /> };
    case '/alertas':
      return { title: 'Alertas', element: <AlertsPage /> };
    case '/design':
      return { title: 'Sistema de diseño', element: <DesignSystemPage /> };
    default: {
      const m = /^\/ordenes\/([^/]+)$/.exec(p);
      if (m?.[1]) return { title: 'Orden de servicio', element: <OrderDetailPage id={decodeURIComponent(m[1])} /> };
      return null;
    }
  }
}

/** Enlace interno que conviene manejar sin recargar (clic izquierdo normal, mismo origen). */
function internalLink(e: MouseEvent): URL | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.('a[href]');
  if (!(a instanceof HTMLAnchorElement)) return null;
  if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return null;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin || !isAppRoute(url.pathname)) return null;
  // Solo cambia el #ancla en la misma página: lo maneja el navegador (ej. «Saltar al contenido»)
  if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return null;
  return url;
}

export default function App() {
  const route = useSyncExternalStore(subscribeRoute, getRoute, getRoute);
  const firstRender = useRef(true);
  const resolved = resolve(route);

  // Precarga: los datos de esta pantalla en paralelo con la verificación de sesión, y en un momento
  // libre los de las demás secciones del menú (así la primera visita también es instantánea)
  useEffect(() => {
    prefetchRoute(window.location.pathname);
    const idle = window.setTimeout(() => {
      void loadSession().then((user) => {
        if (!user) return;
        for (const item of NAV_ITEMS) if (can(user.rol, item.permission)) prefetchRoute(item.href);
      });
    }, 1200);
    return () => window.clearTimeout(idle);
  }, []);

  // Intercepta los clics en enlaces internos y precarga datos al pasar el mouse o el foco
  useEffect(() => {
    setRouterMounted(true);
    const onClick = (e: MouseEvent) => {
      const url = internalLink(e);
      if (!url) return;
      e.preventDefault();
      navigate(url.pathname + url.search + url.hash);
    };
    const onIntent = (e: Event) => {
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!(a instanceof HTMLAnchorElement)) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin === window.location.origin && isAppRoute(url.pathname)) prefetchRoute(url.pathname);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('pointerover', onIntent, { passive: true });
    document.addEventListener('focusin', onIntent);
    return () => {
      setRouterMounted(false);
      document.removeEventListener('click', onClick);
      document.removeEventListener('pointerover', onIntent);
      document.removeEventListener('focusin', onIntent);
    };
  }, []);

  // Al cambiar de pantalla: título de la pestaña, scroll arriba y foco en el contenido
  useEffect(() => {
    if (resolved) document.title = `${resolved.title} · ServicioTécnico`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    document.querySelector('[data-scroll-root]')?.scrollTo(0, 0);
    document.getElementById('contenido')?.focus({ preventScroll: true });
  }, [route.key, resolved?.title]);

  if (!resolved) {
    // Ruta desconocida dentro de la isla: que la resuelva el servidor
    window.location.reload();
    return null;
  }
  // `key` remonta la pantalla en cada navegación (relee filtros de la URL, cierra modales)
  return <Fragment key={route.key}>{resolved.element}</Fragment>;
}
