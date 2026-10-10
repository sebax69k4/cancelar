import { History } from 'lucide-react';
import { AlertFlags } from '@/components/domain/AlertFlags';
import { PriorityBadge } from '@/components/domain/PriorityBadge';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { TBody, THead, Table, Td, Th, Tr } from '@/components/ui/Table';
import { formatRelative } from '@/lib/format';
import type { OrdenResumen } from '@/types/domain';

export function RecentOrders({ orders, nowMs }: { orders: OrdenResumen[]; nowMs: number }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader
        icon={<History aria-hidden="true" />}
        title="Órdenes recientes"
        actions={
          <a href="/ordenes" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
            Ver tablero
          </a>
        }
      />
      {orders.length === 0 ? (
        <EmptyState compact title="Sin órdenes todavía" description="Las órdenes que se registren van a aparecer acá." />
      ) : (
        <>
          {/* Escritorio / tablet */}
          <div className="hidden md:block">
            <Table caption="Órdenes recientes">
              <THead>
                <tr>
                  <Th>Nº</Th>
                  <Th>Cliente</Th>
                  <Th>Equipo</Th>
                  <Th>Estado</Th>
                  <Th>Prioridad</Th>
                  <Th>Ingreso</Th>
                </tr>
              </THead>
              <TBody>
                {orders.map((o) => (
                  <Tr key={o.id}>
                    <Td>
                      <a href={`/ordenes/${o.id}`} className="font-mono font-semibold whitespace-nowrap hover:text-primary hover:underline">
                        {o.numero}
                      </a>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{o.cliente.nombre}</span>
                        <AlertFlags bloqueada={o.bloqueada} escalada={o.escalada} atrasada={o.atrasada} criticaVencida={o.criticaVencida} horasAbierta={o.horasAbierta} />
                      </div>
                    </Td>
                    <Td className="text-muted">
                      {o.equipo.marca} {o.equipo.modelo}
                    </Td>
                    <Td>
                      <StatusBadge estado={o.estado} size="sm" />
                    </Td>
                    <Td>
                      <PriorityBadge prioridad={o.prioridad} size="sm" />
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{formatRelative(o.fechaIngreso, nowMs)}</Td>
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
                  <a href={`/ordenes/${o.id}`} className="font-mono font-semibold whitespace-nowrap hover:underline">
                    {o.numero}
                  </a>
                  <PriorityBadge prioridad={o.prioridad} size="sm" />
                </div>
                <span className="text-sm">
                  {o.cliente.nombre} · <span className="text-muted">{o.equipo.marca} {o.equipo.modelo}</span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge estado={o.estado} size="sm" />
                  <AlertFlags bloqueada={o.bloqueada} escalada={o.escalada} atrasada={o.atrasada} criticaVencida={o.criticaVencida} horasAbierta={o.horasAbierta} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
