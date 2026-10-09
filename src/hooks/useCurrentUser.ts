import { useSyncExternalStore } from 'react';
import { getMockCurrentUser, subscribeCurrentUser } from '@/lib/auth/mockCurrentUser';
import { can, type Permission } from '@/lib/auth/permissions';
import type { Usuario } from '@/types/domain';

export function useCurrentUser(): Usuario | null {
  return useSyncExternalStore(subscribeCurrentUser, getMockCurrentUser, () => null);
}

export function usePermission(permission: Permission): boolean {
  const user = useCurrentUser();
  return user !== null && can(user.rol, permission);
}
