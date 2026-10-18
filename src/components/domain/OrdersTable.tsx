import { ArrowRightLeft } from 'lucide-react';
import { AlertFlags } from '@/components/domain/AlertFlags';
import { PriorityBadge } from '@/components/domain/PriorityBadge';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { UserChip } from '@/components/domain/UserChip';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TBody, THead, Table, Td, Th, Tr } from '@/components/ui/Table';
import { cn } from '@/lib/cn';
import { formatDate, formatHours } from '@/lib/format';
import type { OrdenResumen } from '@/types/domain';

export interface OrdersTableProps {
  orders: OrdenResumen[];
  onMove: (order: OrdenResumen) => void;
}

/** Vista de lista de órdenes: mejor que el tablero para revisar muchas o buscar una en particular. */
export function OrdersTable({ orders, onMove }: OrdersTableProps) {
  return (
    <Card className="overflow-hidden">
      {/* Escritorio / tablet */}
      <div className="hidden md:block">
        <Table caption="Órdenes">
          <THead>
            <tr>
              <Th>Nº</Th>
              <Th>Cliente y equipo</Th>
              <Th>Estado</Th>
              <Th>Prioridad</Th>
              <Th>Técnico</Th>
              <Th className="text-right">Abierta</Th>
              <Th>Entrega</Th>
              <Th className="text-right"><span className="sr-only">Acciones</span></Th>
            </tr>
          </THead>
          <TBody>
            {orders.map((o) => (
              <Tr key={o.id} className={cn(o.criticaVencida && 'bg-red-50/60 dark:bg-red-500/5')}>
                <Td>
                  <a href={`/ordenes/${o.id}`} className="font-mono font-semibold whitespace-nowrap hover:text-primary hover:underline">
                    {o.numero}
                  </a>
                </Td>
                <Td>
                  <p className="font-medium">{o.cliente.nombre}</p>
                  <p className="text-xs text-muted">{o.equipo.marca} {o.equipo.modelo}</p>
                  <AlertFlags className="mt-1" bloqueada={o.bloqueada} escalada={o.escalada} atrasada={o.atrasada} criticaVencida={o.criticaVencida} horasAbierta={o.horasAbierta} />
                </Td>
                <Td><StatusBadge estado={o.estado} size="sm" /></Td>
                <Td><PriorityBadge prioridad={o.prioridad} size="sm" /></Td>
                <Td><UserChip user={o.tecnico} label="Técnico" /></Td>
                <Td className="text-right whitespace-nowrap tabular-nums">{formatHours(o.horasAbierta)}</Td>
                <Td className={cn('whitespace-nowrap', o.atrasada ? 'font-semibold text-warning' : 'text-muted')}>
                  {formatDate(o.fechaEstimada)}
                </Td>
                <Td className="text-right">
                  {o.estado !== 'CERRADO' && (
                    <Button variant="ghost" size="sm" leftIcon={<ArrowRightLeft aria-hidden="true" />} onClick={() => onMove(o)}>
                      Mover<span className="sr-only"> orden {o.numero}</span>
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
      {/* Móvil */}
      <ul className="divide-y divide-border md:hidden">
        {orders.map((o) => (
          <li key={o.id} className="flex flex-col gap-1.5 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <a href={`/ordenes/${o.id}`} className="font-mono font-semibold whitespace-nowrap hover:underline">{o.numero}</a>
              <PriorityBadge prioridad={o.prioridad} size="sm" />
            </div>
            <p className="text-sm">
              {o.cliente.nombre} · <span className="text-muted">{o.equipo.marca} {o.equipo.modelo}</span>
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge estado={o.estado} size="sm" />
              <AlertFlags bloqueada={o.bloqueada} escalada={o.escalada} atrasada={o.atrasada} criticaVencida={o.criticaVencida} horasAbierta={o.horasAbierta} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
