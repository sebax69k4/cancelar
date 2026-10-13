import { useMemo, useState } from 'react';
import { ClipboardPlus, History, Laptop, Plus, Search } from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { EquipmentForm } from '@/components/domain/equipment/EquipmentForm';
import { EquipmentHistory } from '@/components/domain/equipment/EquipmentHistory';
import { TIPO_EQUIPO_ICON } from '@/components/domain/equipment/meta';
import { AppShell } from '@/components/layout/AppShell';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { TBody, THead, Table, Td, Th, Tr } from '@/components/ui/Table';
import { useClients } from '@/hooks/useClients';
import { usePermission } from '@/hooks/useCurrentUser';
import { useDebounced } from '@/hooks/useDebounced';
import { useEquipment } from '@/hooks/useEquipment';
import { useOrders } from '@/hooks/useOrders';
import { errorMessage } from '@/lib/api/errors';
import { TIPO_EQUIPO_LABEL } from '@/lib/domain/labels';
import type { Equipo, OrdenResumen } from '@/types/domain';

function initialClientFilter(): string {
  return new URLSearchParams(window.location.search).get('cliente') ?? '';
}

export default function EquipmentPage() {
  const [creating, setCreating] = useState(false);
  const [clienteId, setClienteId] = useState(initialClientFilter);

  return (
    <AppShell
      currentPath="/equipos"
      permission="nav.equipos"
      title="Equipos"
      description="Notebooks y PC registradas, con el historial de cada ingreso al taller."
      actions={
        <PermissionGuard permission="equipment.create">
          <Button leftIcon={<Plus aria-hidden="true" />} onClick={() => setCreating(true)}>
            Nuevo equipo
          </Button>
        </PermissionGuard>
      }
    >
      <Content clienteId={clienteId} setClienteId={setClienteId} onNew={() => setCreating(true)} />
      <NewEquipmentModal open={creating} defaultClienteId={clienteId} onClose={() => setCreating(false)} />
    </AppShell>
  );
}

function NewEquipmentModal({ open, defaultClienteId, onClose }: { open: boolean; defaultClienteId: string; onClose: () => void }) {
  const clients = useClients('');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar equipo"
      description="El número de serie identifica al equipo y no puede repetirse."
      icon={<Laptop className="text-primary" aria-hidden="true" />}
    >
      <EquipmentForm
        idPrefix="eq-new"
        defaultClienteId={defaultClienteId}
        clientOptions={(clients.data ?? []).map((c) => ({ value: c.id, label: `${c.nombre} · ${c.telefono}` }))}
        onCancel={onClose}
        onCreated={onClose}
      />
    </Modal>
  );
}

function Content({ clienteId, setClienteId, onNew }: { clienteId: string; setClienteId: (id: string) => void; onNew: () => void }) {
  const [q, setQ] = useState('');
  const [historyOf, setHistoryOf] = useState<Equipo | null>(null);
  const debounced = useDebounced(q, 250);
  const equipment = useEquipment({ q: debounced || undefined, clienteId: clienteId || undefined });
  const clients = useClients('');
  const orders = useOrders();
  const canCreateOrder = usePermission('order.create');

  const byEquipment = useMemo(() => {
    const m = new Map<string, OrdenResumen[]>();
    for (const o of orders.data ?? []) m.set(o.equipoId, [...(m.get(o.equipoId) ?? []), o]);
    for (const list of m.values()) list.sort((a, b) => b.fechaIngreso.localeCompare(a.fechaIngreso));
    return m;
  }, [orders.data]);

  const clientName = (id: string) => clients.data?.find((c) => c.id === id)?.nombre ?? '—';

  if (equipment.isPending) return <Skeleton className="h-64" />;
  if (equipment.isError) {
    return (
      <Card>
        <ErrorState message={errorMessage(equipment.error)} onRetry={() => void equipment.refetch()} />
      </Card>
    );
  }

  const list = equipment.data;
  const filtering = Boolean(debounced || clienteId);

  if (list.length === 0 && !filtering) {
    return (
      <Card>
        <EmptyState
          icon={<Laptop aria-hidden="true" />}
          title="Todavía no hay equipos"
          description="Los equipos se registran desde acá o al crear una orden."
          action={
            <PermissionGuard permission="equipment.create">
              <Button leftIcon={<Plus aria-hidden="true" />} onClick={onNew}>Registrar equipo</Button>
            </PermissionGuard>
          }
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-end gap-3 border-b border-border p-3">
        <Input
          id="eq-q"
          label="Buscar equipos"
          hideLabel
          type="search"
          wrapperClassName="w-full sm:max-w-xs"
          leftIcon={<Search aria-hidden="true" />}
          placeholder="Marca, modelo, serie o cliente"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          id="eq-cliente"
          label="Filtrar por cliente"
          hideLabel
          wrapperClassName="w-full sm:w-64"
          placeholder="Todos los clientes"
          value={clienteId}
          onChange={(e) => {
            setClienteId(e.target.value);
            const url = e.target.value ? `?cliente=${e.target.value}` : window.location.pathname;
            window.history.replaceState(null, '', url);
          }}
          options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.nombre }))}
        />
        <p className="ml-auto text-xs text-muted" aria-live="polite">
          {list.length} {list.length === 1 ? 'equipo' : 'equipos'}
        </p>
      </div>

      {list.length === 0 ? (
        <EmptyState compact title="Sin resultados" description="Ningún equipo coincide con los filtros." />
      ) : (
        <>
          <div className="hidden md:block">
            <Table caption="Equipos">
              <THead>
                <tr>
                  <Th>Equipo</Th>
                  <Th>Nº de serie</Th>
                  <Th>Cliente</Th>
                  <Th>Última orden</Th>
                  <Th className="text-right">Órdenes</Th>
                  <Th className="text-right"><span className="sr-only">Acciones</span></Th>
                </tr>
              </THead>
              <TBody>
                {list.map((e) => {
                  const Icon = TIPO_EQUIPO_ICON[e.tipo];
                  const eqOrders = byEquipment.get(e.id) ?? [];
                  const last = eqOrders[0];
                  return (
                    <Tr key={e.id}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <Icon className="size-5 shrink-0 text-muted" aria-hidden="true" />
                          <div>
                            <p className="font-semibold">{e.marca} {e.modelo}</p>
                            <p className="text-xs text-muted">{TIPO_EQUIPO_LABEL[e.tipo]}</p>
                          </div>
                        </div>
                      </Td>
                      <Td className="font-mono text-xs">{e.numeroSerie}</Td>
                      <Td>{clientName(e.clienteId)}</Td>
                      <Td>
                        {last ? (
                          <div className="flex items-center gap-2">
                            <a href={`/ordenes/${last.id}`} className="font-mono text-xs font-semibold whitespace-nowrap hover:underline">{last.numero}</a>
                            <StatusBadge estado={last.estado} size="sm" />
                          </div>
                        ) : (
                          <span className="text-xs text-subtle">Sin órdenes</span>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">{eqOrders.length}</Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" leftIcon={<History aria-hidden="true" />} onClick={() => setHistoryOf(e)}>
                            Historial<span className="sr-only"> de {e.marca} {e.modelo}</span>
                          </Button>
                          {canCreateOrder && (
                            <LinkButton href={`/ordenes/nueva?cliente=${e.clienteId}&equipo=${e.id}`} variant="outline" size="sm" leftIcon={<ClipboardPlus className="size-3.5" aria-hidden="true" />}>
                              Nueva orden
                            </LinkButton>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </div>
          <ul className="divide-y divide-border md:hidden">
            {list.map((e) => {
              const Icon = TIPO_EQUIPO_ICON[e.tipo];
              const count = byEquipment.get(e.id)?.length ?? 0;
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <Icon className="size-5 shrink-0 text-muted" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.marca} {e.modelo}</p>
                    <p className="truncate text-xs text-muted">
                      <span className="font-mono">{e.numeroSerie}</span> · {clientName(e.clienteId)} · {count} órdenes
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setHistoryOf(e)}>Historial</Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <EquipmentHistory equipo={historyOf} onClose={() => setHistoryOf(null)} />
    </Card>
  );
}
