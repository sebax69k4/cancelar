import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Phone, Search, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { controlBase } from '@/components/ui/Field';
import { useClients } from '@/hooks/useClients';
import { useDebounced } from '@/hooks/useDebounced';
import { cn } from '@/lib/cn';
import type { Cliente } from '@/types/domain';

export interface ClientPickerProps {
  value: Cliente | null;
  onChange: (cliente: Cliente | null) => void;
  /** Se llama con el texto buscado cuando el usuario quiere crear un cliente nuevo. */
  onCreateNew: (query: string) => void;
  error?: string;
}

/** Combobox accesible (patrón WAI-ARIA 1.2) para buscar cliente por nombre, teléfono o email. */
export function ClientPicker({ value, onChange, onCreateNew, error }: ClientPickerProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounced(query, 200);
  const clients = useClients(debounced);
  const results = (clients.data ?? []).slice(0, 8);
  // última opción = "crear cliente nuevo"
  const optionCount = results.length + 1;

  function select(c: Cliente) {
    onChange(c);
    setOpen(false);
    setQuery('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % optionCount);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a - 1 + optionCount) % optionCount);
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      const c = results[active];
      if (c) select(c);
      else onCreateNew(query);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-primary bg-primary-soft/50 px-3 py-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-fg" aria-hidden="true">
          {value.nombre.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{value.nombre}</p>
          <p className="flex items-center gap-1 text-xs text-muted">
            <Phone className="size-3" aria-hidden="true" />
            {value.telefono}
            {value.email && <span className="truncate"> · {value.email}</span>}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<X aria-hidden="true" />}
          onClick={() => {
            onChange(null);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          Cambiar
        </Button>
      </div>
    );
  }

  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="mb-1.5 block text-sm font-medium">
        Buscar cliente
        <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
        <span className="sr-only"> (obligatorio)</span>
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
        <input
          ref={inputRef}
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? optionId(active) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          autoComplete="off"
          value={query}
          placeholder="Nombre, teléfono o email"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className={cn(controlBase, 'h-10 pr-3 pl-9 text-sm')}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          Escribí para buscar. Si no existe, creálo desde acá mismo.
        </p>
      )}

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Clientes encontrados"
          className="absolute top-[68px] right-0 left-0 z-20 max-h-72 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-pop"
        >
          {results.map((c, i) => (
            <li
              key={c.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(c)}
              onMouseEnter={() => setActive(i)}
              className={cn('flex cursor-pointer flex-col rounded-sm px-3 py-2', i === active && 'bg-surface-2')}
            >
              <span className="font-medium">{c.nombre}</span>
              <span className="text-xs text-muted">
                {c.telefono}
                {c.email ? ` · ${c.email}` : ''}
              </span>
            </li>
          ))}
          {results.length === 0 && !clients.isFetching && (
            <li role="presentation" className="px-3 py-2 text-xs text-muted">
              {debounced ? `No hay clientes que coincidan con «${debounced}».` : 'Todavía no hay clientes registrados.'}
            </li>
          )}
          <li
            id={optionId(results.length)}
            role="option"
            aria-selected={active === results.length}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onCreateNew(query)}
            onMouseEnter={() => setActive(results.length)}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-sm border-t border-border px-3 py-2 font-semibold text-primary',
              active === results.length && 'bg-primary-soft',
            )}
          >
            <UserPlus className="size-4" aria-hidden="true" />
            {query.trim() ? `Crear cliente «${query.trim()}»` : 'Crear cliente nuevo'}
          </li>
        </ul>
      )}
    </div>
  );
}
