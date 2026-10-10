import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/apiClient';
import { queryClient, queryKeys } from '@/lib/api/queryClient';

export function useDashboard(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => apiClient.getDashboard(),
    enabled: options.enabled ?? true,
  });
}

export function useAlerts() {
  return useQuery({ queryKey: queryKeys.alerts, queryFn: () => apiClient.getAlerts() });
}

export function useMarkReportRead() {
  return useMutation({
    mutationFn: (informeId: string) => apiClient.markCriticalReportRead(informeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
  });
}

export function useResetDemo() {
  return useMutation({
    mutationFn: () => apiClient.resetDemo(),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
