import { cn } from '@/lib/cn';
import { IMPACTO_LABEL, PRIORIDAD_LABEL, URGENCIA_LABEL } from '@/lib/domain/labels';
import { PRIORITY_MATRIX } from '@/lib/workflow/priority';
import { NIVELES_URGENCIA, type Impacto, type Prioridad, type Urgencia } from '@/types/domain';
import { PRIORIDAD_META } from './meta';

const cellTone: Record<Prioridad, string> = {
  BAJA: 'bg-teal-50 text-teal-800 dark:bg-teal-400/10 dark:text-teal-200',
  MEDIA: 'bg-blue-50 text-blue-800 dark:bg-blue-400/10 dark:text-blue-200',
  ALTA: 'bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200',
  CRITICA: 'bg-red-50 text-red-800 dark:bg-red-400/10 dark:text-red-200',
};

const IMPACTO_DESC: readonly Impacto[] = ['ALTO', 'MEDIO', 'BAJO'];

export interface PriorityMatrixProps {
  impacto?: Impacto | null;
  urgencia?: Urgencia | null;
  className?: string;
}

/** Matriz visual 3×3. Se genera desde PRIORITY_MATRIX, así nunca se desincroniza de la regla. */
export function PriorityMatrix({ impacto, urgencia, className }: PriorityMatrixProps) {
  return (
    <table className={cn('w-full table-fixed border-separate border-spacing-1 text-xs', className)}>
      <caption className="sr-only">Matriz de prioridad: impacto por urgencia</caption>
      <thead>
        <tr>
          <th scope="col" className="w-20 text-left font-medium text-muted">
            <span className="sr-only">Impacto</span>
            <span aria-hidden="true">Imp. \ Urg.</span>
          </th>
          {NIVELES_URGENCIA.map((u) => (
            <th key={u} scope="col" className={cn('pb-0.5 font-semibold', u === urgencia ? 'text-fg' : 'text-muted')}>
              {URGENCIA_LABEL[u]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {IMPACTO_DESC.map((i) => (
          <tr key={i}>
            <th scope="row" className={cn('text-left font-semibold', i === impacto ? 'text-fg' : 'text-muted')}>
              {IMPACTO_LABEL[i]}
            </th>
            {NIVELES_URGENCIA.map((u) => {
              const p = PRIORITY_MATRIX[i][u];
              const active = i === impacto && u === urgencia;
              const Icon = PRIORIDAD_META[p].icon;
              return (
                <td
                  key={u}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'h-9 rounded-sm text-center font-medium transition-all',
                    cellTone[p],
                    active ? 'ring-2 ring-fg ring-offset-1 ring-offset-surface font-bold' : 'opacity-70',
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    <Icon className="size-3" aria-hidden="true" />
                    {PRIORIDAD_LABEL[p]}
                  </span>
                  {active && <span className="sr-only"> (selección actual)</span>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
