import { useEffect, useRef } from 'react';
import { Cpu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { can } from '@/lib/auth/permissions';
import { cn } from '@/lib/cn';
import { DemoPanel } from './DemoPanel';
import { NAV_ITEMS, isActive } from './nav';

export interface SidebarProps {
  currentPath: string;
  /** Contadores por href, ej. { '/alertas': 3 } */
  counts?: Partial<Record<string, number>>;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function Brand() {
  return (
    <a href="/dashboard" className="flex items-center gap-2.5 rounded-md px-2 py-1">
      <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-fg">
        <Cpu className="size-[18px]" aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold">ServicioTécnico</span>
        <span className="block text-[11px] text-muted">Workflow de reparaciones</span>
      </span>
    </a>
  );
}

function NavList({ currentPath, counts }: Pick<SidebarProps, 'currentPath' | 'counts'>) {
  const user = useCurrentUser();
  const items = NAV_ITEMS.filter((i) => user && can(user.rol, i.permission));
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(currentPath, href);
        const count = counts?.[href];
        return (
          <li key={href}>
            <a
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                active ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden="true" />
              <span className="flex-1">{label}</span>
              {count !== undefined && count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-700 px-1.5 text-[11px] font-bold text-white dark:bg-red-500 dark:text-red-950">
                  {count}
                  <span className="sr-only"> pendientes</span>
                </span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar({ currentPath, counts, mobileOpen, onMobileClose }: SidebarProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      {/* Escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-border bg-surface px-3 py-4 lg:flex">
        <Brand />
        <nav aria-label="Principal" className="flex-1">
          <NavList currentPath={currentPath} counts={counts} />
        </nav>
        <DemoPanel />
      </aside>

      {/* Móvil / tablet: drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación">
          <div className="absolute inset-0 bg-overlay" onClick={onMobileClose} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 bg-surface px-3 py-4 shadow-pop animate-toast-in">
            <div className="flex items-center justify-between">
              <Brand />
              <Button ref={closeRef} variant="ghost" size="sm" iconOnly aria-label="Cerrar menú" onClick={onMobileClose}>
                <X aria-hidden="true" />
              </Button>
            </div>
            <nav aria-label="Principal" className="flex-1">
              <NavList currentPath={currentPath} counts={counts} />
            </nav>
            <DemoPanel />
          </aside>
        </div>
      )}
    </>
  );
}
