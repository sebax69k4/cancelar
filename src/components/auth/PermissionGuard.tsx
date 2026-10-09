import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { can, type Permission } from '@/lib/auth/permissions';
import { ROL_LABEL } from '@/lib/domain/labels';
import { EmptyState } from '@/components/ui/States';

export interface PermissionGuardProps {
  /** Basta con tener uno de los permisos listados. */
  permission: Permission | readonly Permission[];
  children: ReactNode;
  /** Qué mostrar si no hay permiso. Por defecto no se muestra nada. */
  fallback?: ReactNode;
}

export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
  const user = useCurrentUser();
  const list: readonly Permission[] = typeof permission === 'string' ? [permission] : permission;
  const allowed = user !== null && list.some((p) => can(user.rol, p));
  return <>{allowed ? children : fallback}</>;
}

/** Fallback de página completa para rutas sin acceso. */
export function NoAccess() {
  const user = useCurrentUser();
  return (
    <EmptyState
      icon={<ShieldAlert aria-hidden="true" />}
      title="No tenés acceso a esta sección"
      description={
        user
          ? `Tu rol actual (${ROL_LABEL[user.rol]}) no tiene permiso. Cambiá de rol desde la barra superior para probar.`
          : 'Iniciá sesión para continuar.'
      }
    />
  );
}
