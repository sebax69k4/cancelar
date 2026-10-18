import { Check, Lock } from 'lucide-react';
import { ESTADO_META } from '@/components/domain/meta';
import { cn } from '@/lib/cn';
import { ESTADO_LABEL } from '@/lib/domain/labels';
import { ESTADOS, type EstadoOrden } from '@/types/domain';

/**
 * Línea de pasos del flujo (estilo «process flow» de ServiceNow / Jira): muestra de un vistazo
 * en qué etapa está la orden, cuáles ya pasó y cuáles faltan.
 */
export function WorkflowStepper({ estado, bloqueada }: { estado: EstadoOrden; bloqueada: boolean }) {
  const current = ESTADOS.indexOf(estado);
  const closed = estado === 'CERRADO';

  return (
    <nav aria-label="Etapas de la orden">
      {/* Móvil: compacto */}
      <div className="sm:hidden">
        <p className="text-sm">
          <span className="text-muted">Paso {current + 1} de {ESTADOS.length}:</span>{' '}
          <strong>{ESTADO_LABEL[estado]}</strong>
          {bloqueada && <span className="ml-1 font-semibold text-danger">(bloqueada)</span>}
        </p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
          <div className="h-full rounded-full bg-primary" style={{ width: `${((current + 1) / ESTADOS.length) * 100}%` }} />
        </div>
      </div>

      {/* Escritorio: pasos */}
      <ol className="hidden items-start sm:flex">
        {ESTADOS.map((e, i) => {
          const done = i < current || closed;
          const isCurrent = i === current && !closed;
          const Icon = ESTADO_META[e].icon;
          return (
            <li key={e} className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center" aria-current={isCurrent ? 'step' : undefined}>
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={cn('absolute top-4 right-1/2 h-0.5 w-full', i <= current || closed ? 'bg-success' : 'bg-border')}
                />
              )}
              <span
                className={cn(
                  'relative z-[1] flex size-8 items-center justify-center rounded-full border-2 [&_svg]:size-4',
                  done && 'border-success bg-success text-white dark:text-[#06210f]',
                  isCurrent && !bloqueada && 'border-primary bg-primary text-primary-fg shadow-[0_0_0_4px_var(--primary-soft)]',
                  isCurrent && bloqueada && 'border-danger bg-surface text-danger',
                  !done && !isCurrent && 'border-border-strong bg-surface text-subtle',
                )}
              >
                {done ? <Check aria-hidden="true" /> : isCurrent && bloqueada ? <Lock aria-hidden="true" /> : <Icon aria-hidden="true" />}
              </span>
              <span
                className={cn(
                  'max-w-full truncate px-1 text-xs',
                  isCurrent ? 'font-bold text-fg' : done ? 'font-medium text-fg' : 'text-muted',
                )}
              >
                {ESTADO_LABEL[e]}
              </span>
              <span className="sr-only">
                {done ? '(completado)' : isCurrent ? (bloqueada ? '(etapa actual, bloqueada)' : '(etapa actual)') : '(pendiente)'}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
