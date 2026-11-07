/**
 * Configuración inicial del taller. Copia fiel de backend/src/domain/setup.ts.
 * Admin no figura: quien crea la cuenta ya lo es.
 */
import type { Rol } from '@/types/domain';

export const ROLES_ESENCIALES: readonly Rol[] = ['SUPERVISOR', 'RECEPCION', 'TECNICO'];
export const MIN_PASSWORD = 8;

/** Roles esenciales que nadie activo cubre. Una persona puede cubrir varios. */
export function rolesFaltantes(usuarios: readonly { roles: readonly Rol[]; activo: boolean }[]): Rol[] {
  const cubiertos = new Set(usuarios.filter((u) => u.activo).flatMap((u) => u.roles));
  return ROLES_ESENCIALES.filter((r) => !cubiertos.has(r));
}
