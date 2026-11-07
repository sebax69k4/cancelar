import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SkinToggle } from '@/components/ui/SkinToggle';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { signOut } from '@/lib/auth/mockCurrentUser';
import { rolesLabel } from '@/lib/domain/labels';
import { initials } from '@/lib/format';
import { GlobalSearch } from './GlobalSearch';
import { RoleSwitcher } from './RoleSwitcher';

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const user = useCurrentUser();

  return (
    <header className="ui-toolbar sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur md:px-6 classic:h-12 classic:px-3">
      <Button variant="ghost" iconOnly aria-label="Abrir menú" onClick={onOpenMenu} className="lg:hidden">
        <Menu aria-hidden="true" />
      </Button>

      <GlobalSearch />

      <div className="ml-auto flex items-center gap-1.5">
        <div className="hidden sm:block">
          <RoleSwitcher />
        </div>
        <SkinToggle />
        <ThemeToggle />
        {user && (
          <div className="flex items-center gap-2 pl-1">
            <span
              className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary classic:size-8 classic:rounded-none classic:bg-primary classic:text-primary-fg"
              aria-hidden="true"
            >
              {initials(user.nombre)}
            </span>
            <a href="/cuenta" title="Mi cuenta" className="hidden leading-tight hover:underline xl:block">
              <span className="block text-sm font-semibold">{user.nombre}</span>
              <span className="block text-xs text-muted">{rolesLabel(user.roles)}</span>
            </a>
            <Button
              variant="ghost"
              iconOnly
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              onClick={() => {
                void signOut().then(() => {
                  window.location.href = '/login';
                });
              }}
            >
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
