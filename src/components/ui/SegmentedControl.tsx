import { useId, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  name: string;
  options: readonly SegmentOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  required?: boolean;
  error?: string;
  hint?: string;
}

/** Grupo de radios con aspecto de botones segmentados. Navegable con flechas (nativo). */
export function SegmentedControl<T extends string>({
  label, name, options, value, onChange, required, error, hint,
}: SegmentedControlProps<T>) {
  const id = useId();
  return (
    <fieldset
      className="flex flex-col gap-1.5"
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-1.5 text-sm font-medium">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (obligatorio)</span>}
      </legend>
      <div
        className={cn(
          'grid gap-1 rounded-md border bg-surface-2 p-1',
          error ? 'border-danger' : 'border-border',
        )}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                'flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-sm text-sm font-medium transition-colors',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-focus [&_svg]:size-4',
                checked ? 'bg-surface text-fg shadow-card ring-1 ring-border-strong' : 'text-muted hover:text-fg',
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.icon}
              {o.label}
            </label>
          );
        })}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1 text-xs font-medium text-danger">
          <AlertCircle className="size-3.5" aria-hidden="true" />
          {error}
        </p>
      )}
    </fieldset>
  );
}
