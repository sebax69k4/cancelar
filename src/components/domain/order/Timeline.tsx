import {
  ArrowRight, ArrowRightLeft, ArrowUpCircle, BadgeCheck, CircleCheckBig, FilePlus, Lock, LockOpen,
  PencilLine, RotateCcw, type LucideIcon,
} from 'lucide-react';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { EmptyState } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { ROL_LABEL, TIPO_ACCION_LABEL } from '@/lib/domain/labels';
import { formatDateTime } from '@/lib/format';
import type { Historial, TipoAccion } from '@/types/domain';

const META: Record<TipoAccion, { icon: LucideIcon; className: string }> = {
  CREACION: { icon: FilePlus, className: 'bg-slate-100 text-slate-700 dark:bg-slate-400/15 dark:text-slate-200' },
  TRANSICION: { icon: ArrowRightLeft, className: 'bg-blue-50 text-blue-700 dark:bg-blue-400/15 dark:text-blue-200' },
  BLOQUEO: { icon: Lock, className: 'bg-rose-50 text-rose-700 dark:bg-rose-400/15 dark:text-rose-200' },
  DESBLOQUEO: { icon: LockOpen, className: 'bg-teal-50 text-teal-700 dark:bg-teal-400/15 dark:text-teal-200' },
  ESCALADO: { icon: ArrowUpCircle, className: 'bg-orange-50 text-orange-700 dark:bg-orange-400/15 dark:text-orange-200' },
  REAPERTURA: { icon: RotateCcw, className: 'bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200' },
  VALIDACION: { icon: BadgeCheck, className: 'bg-green-50 text-green-700 dark:bg-green-400/15 dark:text-green-200' },
  CIERRE: { icon: CircleCheckBig, className: 'bg-green-50 text-green-700 dark:bg-green-400/15 dark:text-green-200' },
  ACTUALIZACION: { icon: PencilLine, className: 'bg-gray-100 text-gray-700 dark:bg-gray-400/15 dark:text-gray-300' },
};

/** Línea de tiempo del historial (más reciente primero). */
export function Timeline({ items }: { items: readonly Historial[] }) {
  if (items.length === 0) return <EmptyState compact title="Sin movimientos" />;
  const ordered = [...items].reverse();
  return (
    <ol className="relative flex flex-col">
      {ordered.map((h, i) => {
        const { icon: Icon, className } = META[h.tipo];
        const last = i === ordered.length - 1;
        return (
          <li key={h.id} className="relative flex gap-3 pb-5">
            {!last && <span className="absolute top-9 bottom-0 left-[17px] w-px bg-border" aria-hidden="true" />}
            <span className={cn('relative flex size-9 shrink-0 items-center justify-center rounded-full', className)} aria-hidden="true">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold">{TIPO_ACCION_LABEL[h.tipo]}</span>
                {h.estadoAnterior && h.estadoNuevo && (
                  <span className="flex items-center gap-1">
                    <StatusBadge estado={h.estadoAnterior} size="sm" />
                    <ArrowRight className="size-3.5 text-subtle" aria-label="a" />
                    <StatusBadge estado={h.estadoNuevo} size="sm" />
                  </span>
                )}
                {!h.estadoAnterior && h.estadoNuevo && <StatusBadge estado={h.estadoNuevo} size="sm" />}
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {h.usuario.nombre} ({ROL_LABEL[h.usuario.rol]}) · <time dateTime={h.fecha}>{formatDateTime(h.fecha)}</time>
              </p>
              {h.comentario && (
                <p className="mt-1.5 rounded-md bg-surface-2 px-3 py-2 text-sm whitespace-pre-line">{h.comentario}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
