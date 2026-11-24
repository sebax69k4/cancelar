import { QueryClient } from '@tanstack/react-query';
import { subscribeCurrentUser } from '@/lib/auth/session';
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
  allUsers: ['all-users'] as const,
  allServices: ['all-services'] as const,
  setupMine: ['setup-mine'] as const,
  setupProgress: ['setup-progress'] as const,
  services: ['services'] as const,
  clients: (q: string) => ['clients', q] as const,
  equipment: (params: object) => ['equipment', params] as const,
  equipmentOrders: (id: string) => ['equipment-orders', id] as const,
  orders: (filters: object) => ['orders', filters] as const,
  order: (id: string) => ['order', id] as const,
  dashboard: ['dashboard'] as const,
  alerts: ['alerts'] as const,
};

/* Al iniciar o cerrar sesión se descarta todo lo cargado: los datos son de otra persona. */
if (typeof window !== 'undefined') {
  subscribeCurrentUser(() => void queryClient.invalidateQueries());
}
