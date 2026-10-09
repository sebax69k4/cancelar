import type { Impacto, Prioridad, Urgencia } from '@/types/domain';

/**
 * Matriz impacto × urgencia. Es la única fuente de verdad:
 * la usan el cálculo y el componente visual PriorityMatrix.
 */
export const PRIORITY_MATRIX: Readonly<Record<Impacto, Readonly<Record<Urgencia, Prioridad>>>> = {
  ALTO: { BAJA: 'MEDIA', MEDIA: 'ALTA', ALTA: 'CRITICA' },
  MEDIO: { BAJA: 'MEDIA', MEDIA: 'MEDIA', ALTA: 'ALTA' },
  BAJO: { BAJA: 'BAJA', MEDIA: 'MEDIA', ALTA: 'MEDIA' },
};

export function calculatePriority(impacto: Impacto, urgencia: Urgencia): Prioridad {
  return PRIORITY_MATRIX[impacto][urgencia];
}
