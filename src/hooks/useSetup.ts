import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient, type CreateServiceInput, type CreateUserInput, type UpdateServiceInput, type UpdateTallerInput, type UpdateUserInput } from '@/lib/api/apiClient';
import { isMockApi } from '@/lib/api/config';
import { queryClient, queryKeys } from '@/lib/api/queryClient';

const invalidateAll = () => queryClient.invalidateQueries();

/** Si el taller terminó la configuración inicial. La demo siempre está configurada. */
export function useSetupStatus(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.setupStatus,
    queryFn: () => apiClient.getSetupStatus(),
    enabled: !isMockApi && (options.enabled ?? true),
    staleTime: 60_000,
  });
}

export function useSetupProgress() {
  return useQuery({ queryKey: queryKeys.setupProgress, queryFn: () => apiClient.getSetupProgress() });
}

export function useAllUsers() {
  return useQuery({ queryKey: queryKeys.allUsers, queryFn: () => apiClient.getAllUsers() });
}

export function useAllServices() {
  return useQuery({ queryKey: queryKeys.allServices, queryFn: () => apiClient.getAllServices() });
}

export function useSetupActions() {
  return {
    updateTaller: useMutation({ mutationFn: (input: UpdateTallerInput) => apiClient.updateTaller(input), onSuccess: invalidateAll }),
    complete: useMutation({ mutationFn: () => apiClient.completeSetup(), onSuccess: invalidateAll }),
    createUser: useMutation({ mutationFn: (input: CreateUserInput) => apiClient.createUser(input), onSuccess: invalidateAll }),
    updateUser: useMutation({
      mutationFn: (v: { id: string; input: UpdateUserInput }) => apiClient.updateUser(v.id, v.input),
      onSuccess: invalidateAll,
    }),
    createService: useMutation({ mutationFn: (input: CreateServiceInput) => apiClient.createService(input), onSuccess: invalidateAll }),
    updateService: useMutation({
      mutationFn: (v: { id: string; input: UpdateServiceInput }) => apiClient.updateService(v.id, v.input),
      onSuccess: invalidateAll,
    }),
  };
}
