import { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, rectIntersection,
  useDraggable, useDroppable, useSensor, useSensors,
  type Announcements, type CollisionDetection, type DragEndEvent, type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { Ban, GripVertical } from 'lucide-react';
import { OrderCard } from '@/components/domain/OrderCard';
import { ESTADO_META } from '@/components/domain/meta';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/cn';
import { ESTADO_LABEL } from '@/lib/domain/labels';
import { toast } from '@/lib/toast';
import { canTransition } from '@/lib/workflow/transitions';
import { ESTADOS, type EstadoOrden, type OrdenResumen } from '@/types/domain';

/**
 * El teclado solo inicia el arrastre desde el asa (data-drag-handle), para que
 * Enter/Espacio sobre el enlace o el botón «Mover» mantengan su comportamiento.
 */
const baseKeyboardActivator = KeyboardSensor.activators[0];
class HandleKeyboardSensor extends KeyboardSensor {
  static override activators: typeof KeyboardSensor.activators = baseKeyboardActivator
    ? [
        {
          eventName: baseKeyboardActivator.eventName,
          handler: (event, options, context) => {
            const target = event.target;
            if (!(target instanceof HTMLElement) || !target.hasAttribute('data-drag-handle')) return false;
            return baseKeyboardActivator.handler(event, options, context);
          },
        },
      ]
    : [];
}

/** Con teclado, ← y → saltan a la columna anterior/siguiente. */
const columnCoordinates: KeyboardCoordinateGetter = (event, { context: { collisionRect, droppableRects } }) => {
  if ((event.code !== 'ArrowRight' && event.code !== 'ArrowLeft') || !collisionRect) return undefined;
  event.preventDefault();
  const center = collisionRect.left + collisionRect.width / 2;
  const rects = [...droppableRects.values()].sort((a, b) => a.left - b.left);
  const target =
    event.code === 'ArrowRight'
      ? rects.find((r) => r.left > center)
      : [...rects].reverse().find((r) => r.left + r.width < center);
  if (!target) return undefined;
  return { x: target.left + (target.width - collisionRect.width) / 2, y: target.top + 48 };
};
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

function DraggableOrder({ order, onMove }: { order: OrdenResumen; onMove: () => void }) {
  const disabled = order.estado === 'CERRADO';
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: order.id,
    data: { order },
    disabled,
  });
  return (
    <li ref={setNodeRef} {...listeners} className={cn(!disabled && 'cursor-grab active:cursor-grabbing', 'touch-manipulation')}>
      <OrderCard
        order={order}
        onMove={onMove}
        dragging={isDragging}
        dragHandle={
          !disabled && (
            <button
              type="button"
              ref={setActivatorNodeRef}
              data-drag-handle=""
              {...attributes}
              aria-label={`Arrastrar orden ${order.numero}`}
              className="flex size-6 items-center justify-center rounded-sm text-subtle hover:bg-surface-2 hover:text-fg"
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </button>
          )
        }
      />
    </li>
  );
}

interface ColumnProps {
  estado: EstadoOrden;
  orders: OrdenResumen[];
  dropState: 'idle' | 'allowed' | 'denied' | 'source';
  onMove: (o: OrdenResumen) => void;
}

function KanbanColumn({ estado, orders, dropState, onMove }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: estado });
  const { icon: Icon, dot } = ESTADO_META[estado];
  const headingId = `col-${estado}`;
  const criticas = orders.filter((o) => o.criticaVencida).length;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={cn(
        'relative flex w-[272px] shrink-0 snap-start flex-col rounded-lg border bg-surface-2/70 transition-colors 2xl:w-auto 2xl:min-w-[248px] 2xl:flex-1',
        dropState === 'idle' || dropState === 'source' ? 'border-transparent' : '',
        dropState === 'allowed' && 'border-dashed border-primary',
        dropState === 'allowed' && isOver && 'border-solid bg-primary-soft',
        dropState === 'denied' && 'border-dashed border-border-strong opacity-60',
        dropState === 'denied' && isOver && 'border-danger',
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={cn('size-2 shrink-0 rounded-full', dot)} aria-hidden="true" />
        <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <h2 id={headingId} className="min-w-0 flex-1 truncate text-sm font-semibold">
          {ESTADO_LABEL[estado]}
        </h2>
        {criticas > 0 && (
          <span className="rounded-sm bg-red-700 px-1.5 text-[11px] font-bold text-white dark:bg-red-500 dark:text-red-950" title="Críticas > 24 h">
            {criticas}
            <span className="sr-only"> críticas vencidas</span>
          </span>
        )}
        <span className="rounded-sm bg-surface px-1.5 text-xs font-semibold text-muted tabular-nums">
          {orders.length}
          <span className="sr-only"> órdenes</span>
        </span>
      </header>
      {dropState === 'denied' && (
        <p className="mx-3 mb-2 flex items-center gap-1 text-[11px] font-medium text-muted">
          <Ban className="size-3.5" aria-hidden="true" /> No disponible para esta orden
        </p>
      )}
      <ul className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 lg:max-h-[calc(100dvh-300px)]">
        {orders.map((o) => (
          <DraggableOrder key={o.id} order={o} onMove={() => onMove(o)} />
        ))}
        {orders.length === 0 && (
          <li className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border px-2 py-6 text-center text-xs text-subtle">
            Sin órdenes
          </li>
        )}
      </ul>
    </section>
  );
}

export interface KanbanBoardProps {
  orders: OrdenResumen[];
  /** Columnas a mostrar (filtro por estado). */
  columns?: readonly EstadoOrden[];
  /** Se llama cuando el destino es válido: abre el modal de comentario. */
  onRequestMove: (order: OrdenResumen, to?: EstadoOrden) => void;
}

export function KanbanBoard({ orders, columns = ESTADOS, onRequestMove }: KanbanBoardProps) {
  const user = useCurrentUser();
  const [active, setActive] = useState<OrdenResumen | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(HandleKeyboardSensor, { coordinateGetter: columnCoordinates }),
  );

  const byState = useMemo(() => {
    const map = new Map<EstadoOrden, OrdenResumen[]>(ESTADOS.map((e) => [e, []]));
    for (const o of orders) map.get(o.estado)?.push(o);
    return map;
  }, [orders]);

  const find = (id: string | number) => orders.find((o) => o.id === id) ?? null;
  const label = (id: string | number | undefined) =>
    typeof id === 'string' && (ESTADOS as readonly string[]).includes(id) ? ESTADO_LABEL[id as EstadoOrden] : '';

  const announcements: Announcements = {
    onDragStart: ({ active: a }) => `Tomaste la orden ${find(a.id)?.numero ?? ''}. Usá las flechas para elegir columna y Espacio para soltar.`,
    onDragOver: ({ active: a, over }) => (over ? `Orden ${find(a.id)?.numero ?? ''} sobre la columna ${label(over.id)}.` : 'Fuera de las columnas.'),
    onDragEnd: ({ active: a, over }) => (over ? `Orden ${find(a.id)?.numero ?? ''} soltada en ${label(over.id)}.` : 'Movimiento cancelado.'),
    onDragCancel: ({ active: a }) => `Movimiento de la orden ${find(a.id)?.numero ?? ''} cancelado.`,
  };

  function dropStateFor(estado: EstadoOrden): ColumnProps['dropState'] {
    if (!active || !user) return 'idle';
    if (active.estado === estado) return 'source';
    return canTransition(active, estado, user).ok ? 'allowed' : 'denied';
  }

  function onDragStart(e: DragStartEvent) {
    setActive(find(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    const order = find(e.active.id);
    setActive(null);
    const to = e.over?.id;
    if (!order || !user || typeof to !== 'string' || to === order.estado) return;
    const target = to as EstadoOrden;
    const rule = canTransition(order, target, user);
    if (!rule.ok) {
      toast.error(`No se puede mover ${order.numero} a «${ESTADO_LABEL[target]}»`, { details: rule.missing });
      return;
    }
    onRequestMove(order, target);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'Para mover una orden, enfocá el asa y presioná Espacio. Usá las flechas para cambiar de columna, Espacio para soltar o Escape para cancelar. También podés usar el botón «Mover».',
        },
      }}
    >
      <div className="relative -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 md:-mx-6 md:px-6">
        {columns.map((estado) => (
          <KanbanColumn
            key={estado}
            estado={estado}
            orders={byState.get(estado) ?? []}
            dropState={dropStateFor(estado)}
            onMove={(o) => onRequestMove(o)}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>{active && <OrderCard order={active} overlay />}</DragOverlay>
    </DndContext>
  );
}
