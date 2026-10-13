import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { consumeFlashToast, dismissToast, getToasts, subscribeToasts, type ToastItem, type ToastType } from '@/lib/toast';

const meta: Record<ToastType, { icon: LucideIcon; className: string; label: string }> = {
  success: { icon: CheckCircle2, className: 'text-success', label: 'Éxito' },
  error: { icon: XCircle, className: 'text-danger', label: 'Error' },
  warning: { icon: AlertTriangle, className: 'text-warning', label: 'Atención' },
  info: { icon: Info, className: 'text-info', label: 'Información' },
};

const accent: Record<ToastType, string> = {
  success: 'before:bg-success',
  error: 'before:bg-danger',
  warning: 'before:bg-warning',
  info: 'before:bg-info',
};

function ToastCard({ item }: { item: ToastItem }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const t = window.setTimeout(() => dismissToast(item.id), remaining.current);
    return () => {
      window.clearTimeout(t);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, item.id]);

  const { icon: Icon, className, label } = meta[item.type];

  return (
    <li
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        'ui-window relative flex w-full gap-3 overflow-hidden rounded-lg border border-border bg-surface py-3 pr-2 pl-4 shadow-pop animate-toast-in',
        "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
        accent[item.type],
      )}
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', className)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          <span className="sr-only">{label}: </span>
          {item.title}
        </p>
        {item.description && <p className="mt-0.5 text-muted">{item.description}</p>}
        {item.details && item.details.length > 0 && (
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-muted">
            {item.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        className="flex size-7 shrink-0 items-center justify-center rounded-sm text-subtle hover:bg-surface-2 hover:text-fg"
        aria-label="Cerrar notificación"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}

const empty: readonly ToastItem[] = [];

export function Toaster() {
  const items = useSyncExternalStore(subscribeToasts, getToasts, () => empty);
  useEffect(() => consumeFlashToast(), []);
  const polite = items.filter((t) => t.type !== 'error');
  const assertive = items.filter((t) => t.type === 'error');

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 left-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96">
      <ol aria-live="assertive" aria-relevant="additions" className="pointer-events-auto flex w-full flex-col gap-2">
        {assertive.map((t) => (
          <ToastCard key={t.id} item={t} />
        ))}
      </ol>
      <ol aria-live="polite" aria-relevant="additions" className="pointer-events-auto flex w-full flex-col gap-2">
        {polite.map((t) => (
          <ToastCard key={t.id} item={t} />
        ))}
      </ol>
    </div>
  );
}
