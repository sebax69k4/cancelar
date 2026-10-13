import { useSyncExternalStore } from 'react';
import { getMockCurrentUser, getSessionStatus, subscribeCurrentUser, type SessionStatus } from '@/lib/auth/mockCurrentUser';
import { can, type Permission } from '@/lib/auth/permissions';
import type { Usuario } from '@/types/domain';

export function useCurrentUser(): Usuario | null {
  return useSyncExternalStore(subscribeCurrentUser, getMockCurrentUser, () => null);
}

/** 'loading' mientras se consulta /auth/me (solo modo backend). */
export function useSessionStatus(): SessionStatus {
  return useSyncExternalStore(subscribeCurrentUser, getSessionStatus, () => 'loading');
}

export function usePermission(permission: Permission): boolean {
  const user = useCurrentUser();
  return user !== null && can(user.rol, permission);
}
