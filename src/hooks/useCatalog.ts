import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/apiClient';
import { queryKeys } from '@/lib/api/queryClient';

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users, queryFn: () => apiClient.getUsers(), staleTime: Infinity });
}

export function useServices() {
  return useQuery({ queryKey: queryKeys.services, queryFn: () => apiClient.getServices(), staleTime: Infinity });
}
