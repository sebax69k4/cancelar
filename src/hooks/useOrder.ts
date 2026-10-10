import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient, type EvidenceInput, type UpdateOrderInput } from '@/lib/api/apiClient';
import { queryClient, queryKeys } from '@/lib/api/queryClient';
import type { EstadoOrden } from '@/types/domain';

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => apiClient.getOrder(id),
    enabled: id.length > 0,
    retry: false,
  });
}

const invalidateAll = () => queryClient.invalidateQueries();

/** Todas las acciones del workflow sobre una orden. */
export function useOrderActions(id: string) {
  return {
    update: useMutation({
      mutationFn: (v: { input: UpdateOrderInput; comentario?: string }) => apiClient.updateOrder(id, v.input, v.comentario),
      onSuccess: invalidateAll,
    }),
    block: useMutation({ mutationFn: (motivo: string) => apiClient.blockOrder(id, motivo), onSuccess: invalidateAll }),
    unblock: useMutation({ mutationFn: (comentario: string) => apiClient.unblockOrder(id, comentario), onSuccess: invalidateAll }),
    escalate: useMutation({ mutationFn: (motivo: string) => apiClient.escalateOrder(id, motivo), onSuccess: invalidateAll }),
    reopen: useMutation({
      mutationFn: (v: { to: EstadoOrden; motivo: string }) => apiClient.reopenOrder(id, v.to, v.motivo),
      onSuccess: invalidateAll,
    }),
    validate: useMutation({ mutationFn: (comentario: string) => apiClient.validateOrder(id, comentario), onSuccess: invalidateAll }),
    addEvidence: useMutation({ mutationFn: (file: EvidenceInput) => apiClient.addEvidence(id, file), onSuccess: invalidateAll }),
    removeEvidence: useMutation({ mutationFn: (evidenciaId: string) => apiClient.removeEvidence(id, evidenciaId), onSuccess: invalidateAll }),
    close: useMutation({
      mutationFn: (comentario: string) => apiClient.transitionOrder(id, 'CERRADO', comentario),
      onSuccess: invalidateAll,
    }),
  };
}

export type OrderActions = ReturnType<typeof useOrderActions>;
