import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { NoAccess } from '@/components/auth/PermissionGuard';
import { ErrorState } from '@/components/ui/States';
import { Toaster } from '@/components/ui/Toast';
import { useCurrentUser, useSessionStatus } from '@/hooks/useCurrentUser';
import { loadSession, retrySession } from '@/lib/auth/mockCurrentUser';
import { useDashboard } from '@/hooks/useDashboard';
import { queryClient } from '@/lib/api/queryClient';
import { can, type Permission } from '@/lib/auth/permissions';
import { StatusBar, WindowTitleBar } from './ClassicChrome';
import { RoleSwitcher } from './RoleSwitcher';
import { ShellSkeleton } from './ShellSkeleton';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export interface AppShellProps {
  currentPath: string;
  /** Permiso necesario para ver la página. */
  permission?: Permission;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** La página renderiza su propio encabezado (y su <h1>). */
  customHeader?: boolean;
  children: ReactNode;
}

export function AppShell(props: AppShellProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ShellInner {...props} />
    </QueryClientProvider>
  );
}

function ShellInner({ currentPath, permission, title, description, actions, customHeader, children }: AppShellProps) {
  const user = useCurrentUser();
  const session = useSessionStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const dashboard = useDashboard({ enabled: user !== null && can(user.rol, 'nav.alertas') });

  // Modo backend: recupera la sesión (cookie) desde /auth/me
  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    if (session === 'ready' && !user) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login?next=${next}`);
    }
  }, [session, user]);

  if (session === 'loading') return <ShellSkeleton label="Verificando sesión…" />;
  if (session === 'error') {
    return (
      <div className="flex h-dvh items-center justify-center p-4">
        <ErrorState
          title="No se pudo conectar con el servidor"
          message="Verificá que el backend esté encendido (npm run start:dev en la carpeta backend) y volvé a intentar."
          onRetry={() => void retrySession()}
        />
      </div>
    );
  }
  if (!user) return <ShellSkeleton label="Redirigiendo al inicio de sesión…" />;

  const allowed = !permission || can(user.rol, permission);
  const counts = { '/alertas': dashboard.data?.alertasPendientes ?? 0 };

  return (
    // Estilo clásico: ventana de alto fijo (barra de título + contenido con scroll propio + barra de estado)
    <div className="flex min-h-dvh flex-col classic:h-dvh classic:overflow-hidden">
      <a
        href="#contenido"
        inert={menuOpen}
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 font-semibold text-primary-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <WindowTitleBar title={title} />
      <div className="flex min-h-0 flex-1">
        <Sidebar currentPath={currentPath} counts={counts} mobileOpen={menuOpen} onMobileClose={closeMenu} />
        {/* Con el menú móvil abierto el resto queda inerte: el foco no puede escaparse del menú */}
        <div data-scroll-root inert={menuOpen} className="flex min-w-0 flex-1 flex-col classic:overflow-y-auto">
          <Topbar onOpenMenu={() => setMenuOpen(true)} />
          <main id="contenido" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 focus:outline-none md:px-6 classic:py-4">
            <div className="mb-4 sm:hidden">
              <RoleSwitcher />
            </div>
            {allowed ? (
              <>
                {!customHeader && (
                  <div className="mb-6 flex flex-wrap items-end justify-between gap-4 classic:mb-4 classic:border-b classic:border-border-strong classic:pb-3">
                    <div className="min-w-0">
                      <h1 className="text-2xl font-semibold tracking-tight classic:text-xl classic:font-bold">{title}</h1>
                      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
                    </div>
                    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
                  </div>
                )}
                {children}
              </>
            ) : (
              <NoAccess />
            )}
          </main>
        </div>
      </div>
      <StatusBar />
      <Toaster />
    </div>
  );
}
