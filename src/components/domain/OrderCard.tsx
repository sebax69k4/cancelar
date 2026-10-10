import type { ReactNode } from 'react';
import { ArrowRightLeft, Clock, Laptop } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatHours } from '@/lib/format';
import type { OrdenResumen } from '@/types/domain';
import { AlertFlags } from './AlertFlags';
import { PriorityBadge } from './PriorityBadge';
import { UserChip } from './UserChip';
import { PRIORIDAD_META } from './meta';

export interface OrderCardProps {
  order: OrdenResumen;
  /** Botón accesible «Mover a…» (alternativa al arrastre). */
  onMove?: () => void;
  /** Asa de arrastre (la inyecta el Kanban). */
  dragHandle?: ReactNode;
  dragging?: boolean;
  overlay?: boolean;
  className?: string;
}

export function OrderCard({ order, onMove, dragHandle, dragging, overlay, className }: OrderCardProps) {
  return (
    <article
      aria-label={`Orden ${order.numero}`}
      className={cn(
        'group relative flex flex-col gap-2 rounded-lg border border-l-4 border-border bg-surface p-3 shadow-card transition-shadow',
        PRIORIDAD_META[order.prioridad].border,
        order.criticaVencida && 'ring-1 ring-red-300 dark:ring-red-500/40',
        order.bloqueada && 'bg-[repeating-linear-gradient(135deg,transparent,transparent_8px,rgb(225_29_72/0.05)_8px,rgb(225_29_72/0.05)_16px)]',
        dragging && 'opacity-40',
        overlay && 'rotate-1 shadow-pop',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <a
          href={`/ordenes/${order.id}`}
          className="font-mono text-sm font-semibold whitespace-nowrap text-fg underline-offset-4 after:absolute after:inset-0 after:content-[''] hover:text-primary hover:underline"
        >
          {order.numero}
        </a>
        <div className="relative z-[1] flex items-center gap-1">
          <PriorityBadge prioridad={order.prioridad} size="sm" />
          {dragHandle}
        </div>
      </div>

      <div className="min-w-0">
        <p className="truncate font-medium">{order.cliente.nombre}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted">
          <Laptop className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {order.equipo.marca} {order.equipo.modelo}
          </span>
        </p>
      </div>

      <AlertFlags
        criticaVencida={order.criticaVencida}
        horasAbierta={order.horasAbierta}
        bloqueada={order.bloqueada}
        escalada={order.escalada}
        atrasada={order.atrasada}
      />

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        <UserChip user={order.responsable} label="Responsable" className="min-w-0" />
        <div className="relative z-[1] flex shrink-0 items-center gap-1">
          <span className="flex items-center gap-1 text-xs text-muted tabular-nums" title="Tiempo abierta">
            <Clock className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Abierta hace </span>
            {formatHours(order.horasAbierta)}
          </span>
          {onMove && order.estado !== 'CERRADO' && (
            <button
              type="button"
              onClick={onMove}
              className="flex h-7 items-center gap-1 rounded-sm px-1.5 text-xs font-semibold text-primary hover:bg-primary-soft"
            >
              <ArrowRightLeft className="size-3.5" aria-hidden="true" />
              Mover
              <span className="sr-only"> orden {order.numero}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
