import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/apiClient';
import { queryKeys } from '@/lib/api/queryClient';

// Catálogos casi estáticos: sin refresco periódico (el global es cada 60 s)
const STATIC = { staleTime: Infinity, refetchInterval: false } as const;

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users, queryFn: () => apiClient.getUsers(), ...STATIC });
}

export function useServices() {
  return useQuery({ queryKey: queryKeys.services, queryFn: () => apiClient.getServices(), ...STATIC });
}
