import { QueryClient } from '@tanstack/react-query';
import { subscribeCurrentUser } from '@/lib/auth/mockCurrentUser';
import { subscribeClock } from '@/lib/clock';
import { subscribeDb } from '@/mocks/db';
import { isApiError } from './errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchInterval: 60_000, // recalcula horas abiertas y alertas
      refetchOnWindowFocus: true,
      retry: (count, err) => count < 1 && !(isApiError(err) && err.status < 500),
    },
  },
});

export const queryKeys = {
  users: ['users'] as const,
  services: ['services'] as const,
  clients: (q: string) => ['clients', q] as const,
  equipment: (params: object) => ['equipment', params] as const,
  equipmentOrders: (id: string) => ['equipment-orders', id] as const,
  orders: (filters: object) => ['orders', filters] as const,
  order: (id: string) => ['order', id] as const,
  dashboard: ['dashboard'] as const,
  alerts: ['alerts'] as const,
};

/*
 * DEMO: los datos viven en localStorage. Cuando cambian (esta u otra pestaña),
 * cambia el reloj simulado o el rol, se invalidan todas las consultas.
 * Con NestJS esto se reemplaza por invalidaciones puntuales en cada mutación
 * (y opcionalmente WebSocket/SSE).
 */
if (typeof window !== 'undefined') {
  const invalidate = () => void queryClient.invalidateQueries();
  subscribeDb(invalidate);
  subscribeClock(invalidate);
  subscribeCurrentUser(invalidate);
}
