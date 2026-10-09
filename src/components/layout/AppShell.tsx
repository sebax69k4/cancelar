import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { NoAccess } from '@/components/auth/PermissionGuard';
import { LoadingState } from '@/components/ui/States';
import { Toaster } from '@/components/ui/Toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { can, type Permission } from '@/lib/auth/permissions';
import { RoleSwitcher } from './RoleSwitcher';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export interface AppShellProps {
  currentPath: string;
  /** Permiso necesario para ver la página. */
  permission?: Permission;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  counts?: Partial<Record<string, number>>;
  children: ReactNode;
}

export function AppShell({ currentPath, permission, title, description, actions, counts, children }: AppShellProps) {
  const user = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!user) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login?next=${next}`);
    }
  }, [user]);

  if (!user) return <LoadingState label="Redirigiendo al inicio de sesión…" className="h-dvh" />;

  const allowed = !permission || can(user.rol, permission);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 font-semibold text-primary-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <Sidebar currentPath={currentPath} counts={counts} mobileOpen={menuOpen} onMobileClose={closeMenu} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        <main id="contenido" tabIndex={-1} className="flex-1 px-4 py-6 focus:outline-none md:px-6">
          <div className="mb-4 sm:hidden">
            <RoleSwitcher />
          </div>
          {allowed ? (
            <>
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                  {description && <p className="mt-1 text-sm text-muted">{description}</p>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
              </div>
              {children}
            </>
          ) : (
            <NoAccess />
          )}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
