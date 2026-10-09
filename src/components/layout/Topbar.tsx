import { useEffect, useRef, useState } from 'react';
import { LogOut, Menu, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { signOut } from '@/lib/auth/mockCurrentUser';
import { ROL_LABEL } from '@/lib/domain/labels';
import { initials } from '@/lib/format';
import { RoleSwitcher } from './RoleSwitcher';

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const user = useCurrentUser();
  const searchRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');

  // Atajo "/" enfoca la búsqueda global
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function onSearch(e: { preventDefault: () => void }) {
    e.preventDefault();
    const term = q.trim();
    window.location.href = term ? `/ordenes?q=${encodeURIComponent(term)}` : '/ordenes';
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur md:px-6">
      <Button variant="ghost" iconOnly aria-label="Abrir menú" onClick={onOpenMenu} className="lg:hidden">
        <Menu aria-hidden="true" />
      </Button>

      <form role="search" onSubmit={onSearch} className="relative min-w-0 flex-1 md:max-w-md">
        <label htmlFor="global-search" className="sr-only">
          Buscar orden por número, cliente, teléfono o número de serie
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
        <input
          ref={searchRef}
          id="global-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar orden, cliente, teléfono o serie…"
          className="h-10 w-full rounded-md border border-border bg-surface-2 pr-10 pl-9 text-sm placeholder:text-subtle focus-visible:border-focus focus-visible:bg-surface"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-border bg-surface px-1.5 font-mono text-[11px] text-subtle md:block" aria-hidden="true">
          /
        </kbd>
      </form>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="hidden sm:block">
          <RoleSwitcher />
        </div>
        <ThemeToggle />
        {user && (
          <div className="flex items-center gap-2 pl-1">
            <span
              className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary"
              aria-hidden="true"
            >
              {initials(user.nombre)}
            </span>
            <span className="hidden leading-tight xl:block">
              <span className="block text-sm font-semibold">{user.nombre}</span>
              <span className="block text-xs text-muted">{ROL_LABEL[user.rol]}</span>
            </span>
            <Button
              variant="ghost"
              iconOnly
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              onClick={() => {
                signOut();
                window.location.href = '/login';
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
