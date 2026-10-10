import type { ReactNode } from 'react';
import { CheckCircle2, CircleDashed } from 'lucide-react';
import { cn } from '@/lib/cn';
import { closeChecklist } from '@/lib/workflow/transitions';
import type { Orden } from '@/types/domain';

export interface CloseChecklistProps {
  order: Orden;
  /** Acción opcional por ítem (ej. botón «Validar»). */
  actions?: Partial<Record<'solucion' | 'evidencia' | 'validada', ReactNode>>;
  className?: string;
}

/** Checklist visual de cierre: solución, evidencia y validación. */
export function CloseChecklist({ order, actions, className }: CloseChecklistProps) {
  const items = closeChecklist(order);
  const pending = items.filter((i) => !i.done);
  return (
    <div className={cn('rounded-lg border border-border', className)}>
      <ul className="divide-y divide-border">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
            {i.done ? (
              <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <CircleDashed className="size-5 shrink-0 text-subtle" aria-hidden="true" />
            )}
            <span className={cn('flex-1 text-sm', i.done ? 'font-medium' : 'text-muted')}>
              {i.label}
              <span className="sr-only">{i.done ? ': completo' : ': pendiente'}</span>
            </span>
            {!i.done && actions?.[i.id]}
          </li>
        ))}
      </ul>
      <p
        className={cn(
          'border-t border-border px-3 py-2 text-xs',
          pending.length === 0 ? 'bg-green-50 text-green-900 dark:bg-green-400/10 dark:text-green-200' : 'bg-surface-2 text-muted',
        )}
        aria-live="polite"
      >
        {order.estado === 'CERRADO'
          ? 'Orden cerrada.'
          : pending.length === 0
            ? 'Requisitos de cierre completos.'
            : `Para cerrar falta: ${pending.map((p) => p.missingText.replace(/^Falta /, '').replace(/^la /, '')).join(', ')}.`}
      </p>
    </div>
  );
}
