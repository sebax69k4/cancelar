import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { apiClient, type CreateEquipmentInput } from '@/lib/api/apiClient';
import { queryClient, queryKeys } from '@/lib/api/queryClient';

export function useEquipment(params: { q?: string; clienteId?: string } = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.equipment(params),
    queryFn: () => apiClient.getEquipment(params),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useCreateEquipment() {
  return useMutation({
    mutationFn: (input: CreateEquipmentInput) => apiClient.createEquipment(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipment'] }),
  });
}

export function useEquipmentOrders(equipoId: string | null) {
  return useQuery({
    queryKey: queryKeys.equipmentOrders(equipoId ?? ''),
    queryFn: () => apiClient.getEquipmentOrders(equipoId ?? ''),
    enabled: equipoId !== null,
  });
}
