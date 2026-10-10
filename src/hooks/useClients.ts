import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { apiClient, type CreateClientInput } from '@/lib/api/apiClient';
import { queryClient, queryKeys } from '@/lib/api/queryClient';

export function useClients(q = '') {
  return useQuery({
    queryKey: queryKeys.clients(q),
    queryFn: () => apiClient.getClients(q),
    placeholderData: keepPreviousData,
  });
}

export function useCreateClient() {
  return useMutation({
    mutationFn: (input: CreateClientInput) => apiClient.createClient(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });
}
