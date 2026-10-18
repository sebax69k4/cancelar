import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, Loader2, Search, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Button } from '@/components/ui/Button';
import { useDebounced } from '@/hooks/useDebounced';
import { apiClient } from '@/lib/api/apiClient';
import { queryKeys } from '@/lib/api/queryClient';
import { cn } from '@/lib/cn';
import { navigate } from '@/lib/router';

const MAX_ORDERS = 6;
const MAX_CLIENTS = 3;

interface Option {
  id: string;
  href: string;
}

/**
 * Búsqueda global con resultados al escribir (estilo Linear / Jira): órdenes y clientes.
 * Combobox accesible: ↑ ↓ para moverse, Enter para abrir, Esc para cerrar, «/» para enfocar.
 */
export function GlobalSearch() {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const term = useDebounced(q.trim(), 200);
  const enabled = term.length >= 2;

  const orders = useQuery({
    queryKey: queryKeys.orders({ q: term }),
    queryFn: () => apiClient.getOrders({ q: term }),
    enabled,
  });
  const clients = useQuery({
    queryKey: queryKeys.clients(term),
    queryFn: () => apiClient.getClients(term),
    enabled,
    retry: false, // el técnico puede no tener acceso a clientes en otros despliegues
  });

  const orderList = enabled ? (orders.data ?? []).slice(0, MAX_ORDERS) : [];
  const clientList = enabled ? (clients.data ?? []).slice(0, MAX_CLIENTS) : [];
  const allHref = q.trim() ? `/ordenes?q=${encodeURIComponent(q.trim())}` : '/ordenes';
  const options: Option[] = [
    ...orderList.map((o) => ({ id: `o-${o.id}`, href: `/ordenes/${o.id}` })),
    ...clientList.map((c) => ({ id: `c-${c.id}`, href: `/ordenes?q=${encodeURIComponent(c.nombre)}` })),
    { id: 'all', href: allHref },
  ];
  const loading = enabled && (orders.isFetching || clients.isFetching) && !orders.data;

  // «/» enfoca la búsqueda desde cualquier lugar (si no se está escribiendo en otro campo)
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setActive(-1), [term]);

  function go(href: string) {
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
    navigate(href);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a <= 0 ? options.length - 1 : a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(options[active]?.href ?? allHref);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const listId = `${id}-list`;
  const optId = (i: number) => `${id}-opt-${i}`;
  const showPanel = open && q.trim().length >= 2;
  let index = -1;

  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); go(allHref); }} className="relative flex min-w-0 flex-1 items-center gap-2 md:max-w-xl">
      <label htmlFor="global-search" className="hidden shrink-0 items-center gap-1 text-sm font-bold classic:md:flex">
        <Search className="size-4 text-primary" aria-hidden="true" />
        Buscar:
      </label>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle classic:md:hidden" aria-hidden="true" />
        <input
          ref={inputRef}
          id="global-search"
          type="search"
          role="combobox"
          aria-label="Buscar orden por número, cliente, teléfono o número de serie"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && active >= 0 ? optId(active) : undefined}
          autoComplete="off"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder="Buscar orden, cliente, teléfono o serie…"
          className="ui-field h-10 w-full rounded-md border border-border bg-surface-2 pr-10 pl-9 text-sm placeholder:text-subtle focus-visible:border-focus focus-visible:bg-surface classic:h-8 classic:font-mono classic:md:pl-2"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-border bg-surface px-1.5 font-mono text-[11px] text-subtle md:block" aria-hidden="true">
          /
        </kbd>

        {showPanel && (
          <div className="ui-window absolute top-[calc(100%+6px)] right-0 left-0 z-40 overflow-hidden rounded-lg border border-border bg-surface shadow-pop md:right-auto md:w-[34rem]">
            <ul id={listId} role="listbox" aria-label="Resultados de búsqueda" className="max-h-[70vh] overflow-y-auto p-1">
              {loading && (
                <li role="presentation" className="flex items-center gap-2 px-3 py-2 text-sm text-muted">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Buscando…
                </li>
              )}
              {orderList.length > 0 && (
                <li role="presentation" className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-subtle uppercase">Órdenes</li>
              )}
              {orderList.map((o) => {
                index++;
                const i = index;
                return (
                  <li
                    key={o.id}
                    id={optId(i)}
                    role="option"
                    aria-selected={active === i}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(`/ordenes/${o.id}`)}
                    className={cn('flex cursor-pointer items-center gap-3 rounded-md px-3 py-2', active === i && 'bg-primary-soft')}
                  >
                    <span className="font-mono text-sm font-semibold whitespace-nowrap">{o.numero}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {o.cliente.nombre} <span className="text-muted">· {o.equipo.marca} {o.equipo.modelo}</span>
                    </span>
                    <StatusBadge estado={o.estado} size="sm" />
                  </li>
                );
              })}
              {clientList.length > 0 && (
                <li role="presentation" className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-subtle uppercase">Clientes</li>
              )}
              {clientList.map((c) => {
                index++;
                const i = index;
                return (
                  <li
                    key={c.id}
                    id={optId(i)}
                    role="option"
                    aria-selected={active === i}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(`/ordenes?q=${encodeURIComponent(c.nombre)}`)}
                    className={cn('flex cursor-pointer items-center gap-3 rounded-md px-3 py-2', active === i && 'bg-primary-soft')}
                  >
                    <User className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {c.nombre} <span className="text-muted">· {c.telefono}</span>
                    </span>
                    <span className="text-xs text-muted">Ver sus órdenes</span>
                  </li>
                );
              })}
              {enabled && !loading && orderList.length === 0 && clientList.length === 0 && (
                <li role="presentation" className="px-3 py-3 text-sm text-muted">
                  Sin coincidencias para «{term}».
                </li>
              )}
              {(() => {
                index++;
                const i = index;
                return (
                  <li
                    id={optId(i)}
                    role="option"
                    aria-selected={active === i}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(allHref)}
                    className={cn(
                      'mt-1 flex cursor-pointer items-center gap-2 rounded-md border-t border-border px-3 py-2 text-sm font-semibold text-primary',
                      active === i && 'bg-primary-soft',
                    )}
                  >
                    <Search className="size-4" aria-hidden="true" />
                    Ver todo en el tablero para «{q.trim()}»
                    <ArrowRight className="ml-auto size-4" aria-hidden="true" />
                  </li>
                );
              })()}
            </ul>
          </div>
        )}
      </div>
      <Button type="submit" variant="secondary" size="sm" className="hidden classic:md:inline-flex">
        Buscar
      </Button>
    </form>
  );
}
