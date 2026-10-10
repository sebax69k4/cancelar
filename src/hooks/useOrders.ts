import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { apiClient, type CreateOrderInput, type OrderFilters } from '@/lib/api/apiClient';
import { queryClient, queryKeys } from '@/lib/api/queryClient';
import type { EstadoOrden } from '@/types/domain';

export function useOrders(filters: OrderFilters = {}) {
  return useQuery({
    queryKey: queryKeys.orders(filters),
    queryFn: () => apiClient.getOrders(filters),
    placeholderData: keepPreviousData,
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (input: CreateOrderInput) => apiClient.createOrder(input),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useTransitionOrder() {
  return useMutation({
    mutationFn: (v: { id: string; to: EstadoOrden; comentario: string }) =>
      apiClient.transitionOrder(v.id, v.to, v.comentario),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
