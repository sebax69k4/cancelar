import { History } from 'lucide-react';
import { PriorityBadge } from '@/components/domain/PriorityBadge';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useEquipmentOrders } from '@/hooks/useEquipment';
import { errorMessage } from '@/lib/api/errors';
import { formatDate } from '@/lib/format';
import type { Equipo } from '@/types/domain';

/** Historial de órdenes de un equipo (todas las veces que entró al taller). */
export function EquipmentHistory({ equipo, onClose }: { equipo: Equipo | null; onClose: () => void }) {
  const orders = useEquipmentOrders(equipo?.id ?? null);

  return (
    <Modal
      open={equipo !== null}
      onClose={onClose}
      size="lg"
      title={equipo ? `Historial · ${equipo.marca} ${equipo.modelo}` : 'Historial'}
      description={equipo ? <span className="font-mono">SN {equipo.numeroSerie}</span> : undefined}
      icon={<History className="text-primary" aria-hidden="true" />}
    >
      {orders.isPending ? (
        <LoadingState />
      ) : orders.isError ? (
        <ErrorState message={errorMessage(orders.error)} onRetry={() => void orders.refetch()} />
      ) : orders.data.length === 0 ? (
        <EmptyState compact title="Sin órdenes" description="Este equipo todavía no tuvo órdenes de servicio." />
      ) : (
        <ol className="relative flex flex-col gap-4 border-l-2 border-border pl-5">
          {orders.data.map((o) => (
            <li key={o.id} className="relative">
              <span className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-surface bg-primary" aria-hidden="true" />
              <div className="flex flex-wrap items-center gap-2">
                <a href={`/ordenes/${o.id}`} className="font-mono font-semibold whitespace-nowrap hover:text-primary hover:underline">
                  {o.numero}
                </a>
                <StatusBadge estado={o.estado} size="sm" />
                <PriorityBadge prioridad={o.prioridad} size="sm" />
                <span className="text-xs text-muted">Ingreso {formatDate(o.fechaIngreso)}</span>
              </div>
              <p className="mt-1 text-sm">
                <span className="font-medium">Falla:</span> {o.fallaReportada}
              </p>
              {o.solucion && (
                <p className="mt-0.5 text-sm text-muted">
                  <span className="font-medium text-fg">Solución:</span> {o.solucion}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
