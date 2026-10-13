/**
 * Precarga de datos por ruta: al pasar el mouse (o el foco) por un enlace del menú se piden
 * los datos de esa pantalla, así al hacer clic ya están en caché y no se ven esqueletos.
 * Las claves deben coincidir exactamente con las que usan los hooks de cada página.
 */
import { apiClient } from './apiClient';
import { queryClient, queryKeys } from './queryClient';

const PREFETCH_STALE_MS = 10_000;

function prefetch(queryKey: readonly unknown[], queryFn: () => Promise<unknown>): void {
  // Si hay datos frescos (menos de 10 s) no pide nada; los errores se ignoran: la pantalla reintenta al abrirse
  queryClient.query({ queryKey, queryFn, staleTime: PREFETCH_STALE_MS }).catch(() => undefined);
}

export function prefetchRoute(pathname: string): void {
  switch (pathname) {
    case '/dashboard':
      prefetch(queryKeys.dashboard, () => apiClient.getDashboard());
      break;
    case '/ordenes':
      prefetch(queryKeys.orders({}), () => apiClient.getOrders({}));
      prefetch(queryKeys.users, () => apiClient.getUsers());
      break;
    case '/ordenes/nueva':
      prefetch(queryKeys.users, () => apiClient.getUsers());
      prefetch(queryKeys.services, () => apiClient.getServices());
      prefetch(queryKeys.clients(''), () => apiClient.getClients(''));
      break;
    case '/clientes':
      prefetch(queryKeys.clients(''), () => apiClient.getClients(''));
      prefetch(queryKeys.equipment({}), () => apiClient.getEquipment({}));
      prefetch(queryKeys.orders({}), () => apiClient.getOrders({}));
      break;
    case '/equipos':
      prefetch(queryKeys.equipment({}), () => apiClient.getEquipment({}));
      prefetch(queryKeys.clients(''), () => apiClient.getClients(''));
      prefetch(queryKeys.orders({}), () => apiClient.getOrders({}));
      break;
    case '/alertas':
      prefetch(queryKeys.alerts, () => apiClient.getAlerts());
      break;
    default: {
      const m = /^\/ordenes\/([^/]+)$/.exec(pathname);
      if (m?.[1] && m[1] !== 'nueva') prefetch(queryKeys.order(m[1]), () => apiClient.getOrder(m[1]!));
    }
  }
}
